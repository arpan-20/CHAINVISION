# P1 seed data

`p1_seed_data.json` contains the reproducible master-data definitions and the deliberate low-stock scenarios. `p1_seed.ts` expands those definitions into the complete P1 dataset:

- 18 SKUs across antibiotics, analgesics, and cold/flu
- 4 distribution centers: 2 tier-1 and 2 tier-2
- 144 inventory batches: 2 batches for every SKU/DC combination
- 6,480 demand signals: 90 daily signals for every SKU/DC combination
- Seasonal signals use a +60% adjustment for the last 14 days of cold/flu demand in tier-2 centers
- Five SKU/DC combinations are deliberately below reorder-point-equivalent stock

## Run

From the repository root, with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` available in the environment:

```powershell
$env:NODE_PATH = (Resolve-Path 'p1-backend/node_modules').Path
$env:TS_NODE_COMPILER_OPTIONS = '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true}'
& 'p1-backend/node_modules/.bin/ts-node.cmd' --transpile-only shared/seed-data/p1_seed.ts
```

The script resets only the P1 tables, then inserts distribution centers and SKUs before their batches and demand signals. It does not touch PR2 tables or `public.users`, and it is safe to rerun for a clean P1 dataset.

The custom `p1` and `pr2` schemas must be exposed in Supabase API settings, and the server-side API role must have schema/table privileges. Keep the service-role key server-side and never commit it.
