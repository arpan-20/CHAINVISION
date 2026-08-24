import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type SkuDefinition = {
  sku_code: string;
  name: string;
  category: string;
  unit_cost: number;
  lead_time_days: number;
};

type DcDefinition = {
  dc_code: string;
  name: string;
  region: string;
  capacity_units: number;
};

type LowStockScenario = {
  sku_code: string;
  dc_code: string;
  quantity: number;
  reason: string;
};

type SeedDefinition = {
  asOfDate: string;
  skus: SkuDefinition[];
  distribution_centers: DcDefinition[];
  lowStockScenarios: LowStockScenario[];
  generation: {
    historyDays: number;
    seasonalAdjustmentPct: number;
    seasonalWindowDays: number;
    batchesPerSkuDc: number;
    nearExpiryDays: number;
    warningExpiryDays: number;
  };
};

type InsertedRow = { id: string };

const definitionPath = path.join(__dirname, 'p1_seed_data.json');
const definition = JSON.parse(fs.readFileSync(definitionPath, 'utf8')) as SeedDefinition;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const asOfDate = new Date(`${definition.asOfDate}T00:00:00.000Z`);

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateOffset(days: number): string {
  const date = new Date(asOfDate);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function insertInChunks<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  size = 500
): Promise<InsertedRow[]> {
  const inserted: InsertedRow[] = [];
  for (const rowsChunk of chunk(rows, size)) {
    const { data, error } = await supabase.schema('p1').from(table).insert(rowsChunk).select('id');
    if (error) throw new Error(`Failed inserting p1.${table}: ${error.message}`);
    inserted.push(...((data ?? []) as InsertedRow[]));
  }
  return inserted;
}

async function deleteAll(table: string): Promise<void> {
  const { error } = await supabase.schema('p1').from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(`Failed resetting p1.${table}: ${error.message}`);
}

function scenarioQuantity(skuCode: string, dcCode: string, fallback: number): number {
  return definition.lowStockScenarios.find(
    (scenario) => scenario.sku_code === skuCode && scenario.dc_code === dcCode
  )?.quantity ?? fallback;
}

function baseDailyDemand(skuIndex: number, dcIndex: number): number {
  return 24 + ((skuIndex * 11 + dcIndex * 7) % 26);
}

async function seed(): Promise<void> {
  await Promise.all([
    deleteAll('replenishment_recommendations'),
    deleteAll('demand_signals'),
    deleteAll('inventory_batches')
  ]);
  await Promise.all([deleteAll('skus'), deleteAll('distribution_centers')]);

  const insertedDcs = await insertInChunks('distribution_centers', definition.distribution_centers);
  const insertedSkus = await insertInChunks('skus', definition.skus);
  const dcByCode = new Map(definition.distribution_centers.map((dc, index) => [dc.dc_code, insertedDcs[index].id]));
  const skuByCode = new Map(definition.skus.map((sku, index) => [sku.sku_code, insertedSkus[index].id]));
  const lowStockKeys = new Set(definition.lowStockScenarios.map((scenario) => `${scenario.sku_code}:${scenario.dc_code}`));

  const inventoryRows: Record<string, unknown>[] = [];
  const demandRows: Record<string, unknown>[] = [];

  definition.skus.forEach((sku, skuIndex) => {
    definition.distribution_centers.forEach((dc, dcIndex) => {
      const key = `${sku.sku_code}:${dc.dc_code}`;
      const dailyDemand = baseDailyDemand(skuIndex, dcIndex);
      const fallbackQuantity = dailyDemand * (dc.region === 'tier-2' ? 13 : 24);
      const totalQuantity = scenarioQuantity(sku.sku_code, dc.dc_code, fallbackQuantity);
      const firstBatchQuantity = Math.ceil(totalQuantity * 0.55);
      const secondBatchQuantity = totalQuantity - firstBatchQuantity;
      const expiryBase = lowStockKeys.has(key)
        ? definition.generation.nearExpiryDays
        : skuIndex % 7 === 0 && dcIndex % 2 === 0
          ? -8
          : 125 + ((skuIndex * 13 + dcIndex * 9) % 120);

      inventoryRows.push(
        {
          sku_id: skuByCode.get(sku.sku_code),
          dc_id: dcByCode.get(dc.dc_code),
          batch_no: `${sku.sku_code}-${dc.dc_code}-A`,
          quantity: firstBatchQuantity,
          expiry_date: dateOffset(expiryBase),
          received_date: dateOffset(expiryBase - 90)
        },
        {
          sku_id: skuByCode.get(sku.sku_code),
          dc_id: dcByCode.get(dc.dc_code),
          batch_no: `${sku.sku_code}-${dc.dc_code}-B`,
          quantity: secondBatchQuantity,
          expiry_date: dateOffset(lowStockKeys.has(key) ? definition.generation.warningExpiryDays : expiryBase + 75),
          received_date: dateOffset((lowStockKeys.has(key) ? definition.generation.warningExpiryDays : expiryBase + 75) - 90)
        }
      );

      for (let dayIndex = definition.generation.historyDays - 1; dayIndex >= 0; dayIndex -= 1) {
        const seasonal = dc.region === 'tier-2'
          && sku.category === 'cold/flu'
          && dayIndex < definition.generation.seasonalWindowDays;
        const weeklyPattern = ((dayIndex + skuIndex + dcIndex) % 7) - 3;
        demandRows.push({
          sku_id: skuByCode.get(sku.sku_code),
          dc_id: dcByCode.get(dc.dc_code),
          signal_date: dateOffset(-dayIndex),
          historical_demand: Math.max(0, dailyDemand + weeklyPattern),
          sensed_adjustment_pct: seasonal ? definition.generation.seasonalAdjustmentPct : 0,
          source: seasonal ? 'seasonal' : 'historical'
        });
      }
    });
  });

  await insertInChunks('inventory_batches', inventoryRows);
  await insertInChunks('demand_signals', demandRows);

  console.log(JSON.stringify({
    schema: 'p1',
    asOfDate: definition.asOfDate,
    counts: {
      skus: insertedSkus.length,
      distribution_centers: insertedDcs.length,
      inventory_batches: inventoryRows.length,
      demand_signals: demandRows.length,
      replenishment_recommendations: 0
    },
    lowStockScenarios: definition.lowStockScenarios
  }, null, 2));
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
