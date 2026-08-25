-- pr2-backend/local-dev/init-db.sql
-- LOCAL DEVELOPMENT ONLY. Mirrors the `pr2` schema tables defined in
-- ../../Documentaion/00_PROJECT_CONTEXT.md Section 7.2. Add more tables
-- here (purchase_orders, goods_receipts, invoices, three_way_matches,
-- payment_approvals) as those phases are implemented, keeping this file
-- in sync with Section 7.2 so it stays a faithful local stand-in for the
-- real Supabase schema.

create extension if not exists pgcrypto;

create schema if not exists pr2;

create table if not exists pr2.suppliers (
    id                  uuid primary key default gen_random_uuid(),
    name                text not null,
    price_index         numeric not null,
    avg_lead_time_days  int not null,
    otd_score           numeric not null,
    quality_score       numeric not null,
    capacity_units      int not null
);

create table if not exists pr2.purchase_requisitions (
    id                  uuid primary key default gen_random_uuid(),
    recommendation_id   text,
    sku_code            text not null,
    dc_code             text not null,
    quantity            int not null check (quantity > 0),
    urgency             text not null check (urgency in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    source              text not null check (source in ('SYSTEM', 'CHATBOT', 'MANUAL')),
    raw_nl_input        text,
    status              text not null default 'CREATED' check (status in ('CREATED', 'SOURCED', 'PO_RAISED')),
    created_at          timestamptz not null default now()
);

create table if not exists pr2.purchase_orders (
    id                  uuid primary key default gen_random_uuid(),
    requisition_id      uuid not null references pr2.purchase_requisitions(id),
    supplier_id         uuid not null references pr2.suppliers(id),
    quantity            int not null check (quantity > 0),
    unit_price          numeric not null check (unit_price > 0),
    total_amount        numeric not null,
    status              text not null default 'ISSUED' check (status in ('ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED')),
    created_at          timestamptz not null default now()
);

create table if not exists pr2.goods_receipts (
    id                  uuid primary key default gen_random_uuid(),
    po_id               uuid not null references pr2.purchase_orders(id),
    received_qty        int not null check (received_qty > 0),
    batch_no            text,
    expiry_date         date,
    received_at         timestamptz not null default now()
);

create table if not exists pr2.invoices (
    id                  uuid primary key default gen_random_uuid(),
    po_id               uuid references pr2.purchase_orders(id),
    invoice_number      text,
    vendor_name_ocr     text,
    quantity_ocr        int,
    unit_price_ocr      numeric,
    total_ocr           numeric,
    raw_ocr_json        jsonb,
    uploaded_file_ref   text,
    status              text not null default 'PENDING_MATCH' check (status in ('PENDING_MATCH', 'MATCHED', 'MISMATCHED', 'APPROVED', 'EXCEPTION')),
    created_at          timestamptz not null default now()
);

create table if not exists pr2.three_way_matches (
    id                  uuid primary key default gen_random_uuid(),
    invoice_id          uuid not null references pr2.invoices(id),
    po_id               uuid not null references pr2.purchase_orders(id),
    grn_id              uuid references pr2.goods_receipts(id),
    qty_match           boolean not null,
    price_match         boolean not null,
    result              text not null check (result in ('MATCHED', 'MISMATCHED')),
    mismatch_reason     text,
    ai_explanation      text,
    matched_at          timestamptz not null default now()
);

create table if not exists pr2.payment_approvals (
    id                  uuid primary key default gen_random_uuid(),
    invoice_id          uuid not null references pr2.invoices(id),
    status              text not null check (status in ('AUTO_APPROVED', 'PENDING_REVIEW', 'REJECTED', 'APPROVED_MANUAL')),
    approved_by         text,
    approved_at         timestamptz
);

-- A few sample suppliers so /api/suppliers and later supplier-scoring
-- work have non-empty data to demo against locally.
insert into pr2.suppliers (name, price_index, avg_lead_time_days, otd_score, quality_score, capacity_units)
values
    ('MedSource Distributors', 0.85, 5, 0.97, 0.95, 10000),
    ('QuickPharma Supply Co.', 0.70, 3, 0.80, 0.75, 6000),
    ('Reliable Health Logistics', 1.10, 9, 0.99, 0.98, 15000)
on conflict do nothing;
