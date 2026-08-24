import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type P1Definition = { skus: Array<{ sku_code: string; name: string }> };
type Supplier = {
  id: string;
  name: string;
  price_index: number;
  avg_lead_time_days: number;
  otd_score: number;
  quality_score: number;
  capacity_units: number;
  profile: string;
};
type Requisition = {
  id: string;
  recommendation_id: string | null;
  sku_code: string;
  dc_code: string;
  quantity: number;
  urgency: string;
  source: 'SYSTEM' | 'CHATBOT' | 'MANUAL';
  raw_nl_input: string | null;
  status: 'CREATED' | 'SOURCED' | 'PO_RAISED';
};
type PurchaseOrder = {
  id: string;
  requisition_id: string;
  supplier_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: 'ISSUED' | 'ACKNOWLEDGED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED';
};
type GoodsReceipt = {
  id: string;
  po_id: string;
  received_qty: number;
  batch_no: string;
  expiry_date: string;
  received_at: string;
};
type InvoiceFixture = {
  file: string;
  invoice_number: string;
  po_id: string;
  grn_id: string;
  sku_code: string;
  sku_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  expected_result: string;
};
type SeedData = {
  asOfDate: string;
  suppliers: Supplier[];
  purchase_requisitions: Requisition[];
  purchase_orders: PurchaseOrder[];
  goods_receipts: GoodsReceipt[];
  invoiceFixtures: InvoiceFixture[];
};

type RowWithId = { id: string };

const dataPath = path.join(__dirname, 'pr2_seed_data.json');
const p1DataPath = path.join(__dirname, 'p1_seed_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as SeedData;
const p1Data = JSON.parse(fs.readFileSync(p1DataPath, 'utf8')) as P1Definition;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const p1SkuCodes = new Set(p1Data.skus.map((sku) => sku.sku_code));

async function upsertRows<T extends Record<string, unknown>>(table: string, rows: T[]): Promise<RowWithId[]> {
  const { data: inserted, error } = await supabase.schema('pr2').from(table).upsert(rows, { onConflict: 'id' }).select('id');
  if (error) throw new Error(`Failed upserting pr2.${table}: ${error.message}`);
  return (inserted ?? []) as RowWithId[];
}

async function resetSeedRows(): Promise<void> {
  const tableIds: Array<[string, string[]]> = [
    ['goods_receipts', data.goods_receipts.map((row) => row.id)],
    ['purchase_orders', data.purchase_orders.map((row) => row.id)],
    ['purchase_requisitions', data.purchase_requisitions.map((row) => row.id)],
    ['suppliers', data.suppliers.map((row) => row.id)]
  ];
  for (const [table, ids] of tableIds) {
    const { error } = await supabase.schema('pr2').from(table).delete().in('id', ids);
    if (error) throw new Error(`Failed resetting pr2.${table}: ${error.message}`);
  }
}

async function seed(): Promise<void> {
  for (const fixture of data.invoiceFixtures) {
    if (!p1SkuCodes.has(fixture.sku_code)) {
      throw new Error(`Invoice fixture references SKU ${fixture.sku_code}, which is absent from p1_seed_data.json.`);
    }
  }

  if (process.argv.includes('--reset')) {
    await resetSeedRows();
  }

  const suppliers = await upsertRows('suppliers', data.suppliers.map(({ profile: _profile, ...supplier }) => supplier));
  const requisitions = await upsertRows('purchase_requisitions', data.purchase_requisitions);
  const purchaseOrders = await upsertRows('purchase_orders', data.purchase_orders);
  const goodsReceipts = await upsertRows('goods_receipts', data.goods_receipts);

  console.log(JSON.stringify({
    schema: 'pr2',
    asOfDate: data.asOfDate,
    counts: {
      suppliers: suppliers.length,
      purchase_requisitions: requisitions.length,
      purchase_orders: purchaseOrders.length,
      goods_receipts: goodsReceipts.length,
      invoices: 0
    },
    invoiceFixtures: data.invoiceFixtures
  }, null, 2));
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
