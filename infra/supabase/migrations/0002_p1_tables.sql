-- CHAINVISION P2.1: P1 schema tables.
CREATE TABLE IF NOT EXISTS p1.skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  unit_cost numeric NOT NULL,
  lead_time_days int NOT NULL
);

CREATE TABLE IF NOT EXISTS p1.distribution_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_code text NOT NULL UNIQUE,
  name text NOT NULL,
  region text NOT NULL,
  capacity_units int NOT NULL
);

CREATE TABLE IF NOT EXISTS p1.inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES p1.skus(id),
  dc_id uuid NOT NULL REFERENCES p1.distribution_centers(id),
  batch_no text NOT NULL,
  quantity int NOT NULL,
  expiry_date date NOT NULL,
  received_date date NOT NULL
);

CREATE TABLE IF NOT EXISTS p1.demand_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES p1.skus(id),
  dc_id uuid NOT NULL REFERENCES p1.distribution_centers(id),
  signal_date date NOT NULL,
  historical_demand int NOT NULL,
  sensed_adjustment_pct numeric NOT NULL,
  source text NOT NULL
);

CREATE TABLE IF NOT EXISTS p1.replenishment_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES p1.skus(id),
  dc_id uuid NOT NULL REFERENCES p1.distribution_centers(id),
  recommended_qty int NOT NULL,
  reorder_point numeric NOT NULL,
  safety_stock numeric NOT NULL,
  eoq numeric NOT NULL,
  urgency p1.urgency NOT NULL,
  reason_code text NOT NULL,
  ai_rationale text,
  status p1.recommendation_status NOT NULL DEFAULT 'NEW',
  created_at timestamp NOT NULL DEFAULT now()
);
