# CHAINVISION Supabase setup

These numbered migrations create the two application schemas, the shared users table, row-level security policies, and the Realtime publication entries required by the frontend.

## Apply the migrations

1. Create a Supabase project at <https://supabase.com/dashboard>.
2. Open the project's **SQL Editor**.
3. Run the files in this order, each as a complete script:
   - `infra/supabase/migrations/0001_create_schemas.sql`
   - `infra/supabase/migrations/0002_p1_tables.sql`
   - `infra/supabase/migrations/0003_pr2_tables.sql`
   - `infra/supabase/migrations/0004_shared_users_and_rls.sql`
4. In the SQL Editor, verify the tables with:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('p1', 'pr2')
   OR (table_schema = 'public' AND table_name = 'users')
ORDER BY table_schema, table_name;
```

For a local Supabase CLI workflow, link the project and apply the migrations with `supabase db push`. Do not commit generated local Supabase state or credentials.

## Required configuration names

Copy the repository `.env.example` to `.env` and fill in values from the Supabase project settings. Later backend and frontend phases use these names:

- `SUPABASE_URL`: project URL
- `SUPABASE_ANON_KEY`: public anon key for the frontend
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service role key for backend writes
- `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_NAME`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`: database connection values when using a direct PostgreSQL connection

Never expose or commit `SUPABASE_SERVICE_ROLE_KEY` or database passwords to frontend code.

## Security and Realtime notes

RLS is enabled on every `p1`, `pr2`, and `public.users` table. Each table has an authenticated read policy. Backend writes must use the server-side Supabase service-role key; no public write policy is created.

Migration `0004` adds these tables to `supabase_realtime` when the publication is available: `p1.replenishment_recommendations`, `p1.inventory_batches`, `pr2.purchase_requisitions`, `pr2.purchase_orders`, `pr2.invoices`, and `pr2.payment_approvals`. If the migration reports that the publication is unavailable, enable Realtime for the project and rerun `0004`.
