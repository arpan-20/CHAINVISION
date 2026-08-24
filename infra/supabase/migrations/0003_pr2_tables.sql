-- CHAINVISION P2.1: PR2 schema tables.
CREATE TABLE IF NOT EXISTS pr2.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_index numeric NOT NULL,
  avg_lead_time_days int NOT NULL,
  otd_score numeric NOT NULL,
  quality_score numeric NOT NULL,
  capacity_units int NOT NULL
);

CREATE TABLE IF NOT EXISTS pr2.purchase_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id text,
  sku_code text NOT NULL,
  dc_code text NOT NULL,
  quantity int NOT NULL,
  urgency text NOT NULL,
  source pr2.requisition_source NOT NULL,
  raw_nl_input text,
  status pr2.requisition_status NOT NULL DEFAULT 'CREATED',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pr2.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES pr2.purchase_requisitions(id),
  supplier_id uuid NOT NULL REFERENCES pr2.suppliers(id),
  quantity int NOT NULL,
  unit_price numeric NOT NULL,
  total_amount numeric NOT NULL,
  status pr2.purchase_order_status NOT NULL DEFAULT 'ISSUED',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pr2.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES pr2.purchase_orders(id),
  received_qty int NOT NULL,
  batch_no text NOT NULL,
  expiry_date date NOT NULL,
  received_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pr2.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid REFERENCES pr2.purchase_orders(id),
  invoice_number text NOT NULL,
  vendor_name_ocr text NOT NULL,
  quantity_ocr int NOT NULL,
  unit_price_ocr numeric NOT NULL,
  total_ocr numeric NOT NULL,
  raw_ocr_json jsonb NOT NULL,
  uploaded_file_ref text NOT NULL,
  status pr2.invoice_status NOT NULL DEFAULT 'PENDING_MATCH',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pr2.three_way_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES pr2.invoices(id),
  po_id uuid NOT NULL REFERENCES pr2.purchase_orders(id),
  grn_id uuid NOT NULL REFERENCES pr2.goods_receipts(id),
  qty_match boolean NOT NULL,
  price_match boolean NOT NULL,
  result pr2.match_result NOT NULL,
  mismatch_reason text,
  ai_explanation text,
  matched_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pr2.payment_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES pr2.invoices(id),
  status pr2.payment_approval_status NOT NULL,
  approved_by text,
  approved_at timestamp
);
