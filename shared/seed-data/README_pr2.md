# PR2 seed data

`pr2_seed_data.json` contains reproducible synthetic PR2 master and demo-flow data. It reuses the SKU codes from `p1_seed_data.json` and seeds:

- 8 suppliers with varied price, lead time, OTD, quality, and capacity scores
- 5 purchase requisitions
- 3 purchase orders in `RECEIVED`, `ISSUED`, and `CLOSED` states
- 3 matching goods receipts
- 3 invoice fixtures for the later upload/OCR/matching phases

The supplier profiles intentionally include `Apex Generics` as cheap but unreliable and `MedSure Life Sciences` as expensive but high-performing. The deterministic supplier-scoring phase can demonstrate that price alone does not decide the winner.

## Run

From the repository root, with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` available in the environment:

```powershell
$env:NODE_PATH = (Resolve-Path 'p1-backend/node_modules').Path
$env:TS_NODE_COMPILER_OPTIONS = '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true}'
& 'p1-backend/node_modules/.bin/ts-node.cmd' --transpile-only shared/seed-data/pr2_seed.ts
```

Add `--reset` to remove and recreate only the fixed seed rows before upserting them. Without `--reset`, the script is idempotent for its fixed IDs and does not remove unrelated PR2 rows.

## Invoice fixtures

- `sample_invoices/invoice_matching.pdf` targets PO `22000000-0000-0000-0000-000000000001` and GRN `23000000-0000-0000-0000-000000000001`; quantity and price match.
- `sample_invoices/invoice_qty_mismatch.pdf` targets PO `22000000-0000-0000-0000-000000000002` and GRN `23000000-0000-0000-0000-000000000002`; invoice quantity is 700 while the PO/GRN quantity is 900.
- `sample_invoices/invoice_price_mismatch.pdf` targets PO `22000000-0000-0000-0000-000000000003` and GRN `23000000-0000-0000-0000-000000000003`; invoice unit price is 4.25 while the PO unit price is 3.706.

The PDFs are intentionally plain, high-contrast, and text-heavy so they are easy to inspect and suitable for the later OCR phase.
