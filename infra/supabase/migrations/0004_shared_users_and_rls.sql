-- CHAINVISION P2.1: shared users table, RLS, and Realtime publication.
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role public.user_role NOT NULL
);

DO $$
DECLARE
  table_record record;
  policy_name text;
BEGIN
  FOR table_record IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE (table_schema IN ('p1', 'pr2') OR (table_schema = 'public' AND table_name = 'users'))
      AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', table_record.table_schema, table_record.table_name);

    policy_name := table_record.table_name || '_authenticated_read';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = table_record.table_schema
        AND tablename = table_record.table_name
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR SELECT TO authenticated USING (true)',
        policy_name,
        table_record.table_schema,
        table_record.table_name
      );
    END IF;
  END LOOP;
END
$$;

-- Backend writes use the Supabase service-role key, which bypasses RLS.
-- The frontend receives only the anon key and can read as an authenticated user.
DO $$
DECLARE
  publication_exists boolean;
  table_record record;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) INTO publication_exists;

  IF publication_exists THEN
    FOR table_record IN
      SELECT *
      FROM (VALUES
        ('p1'::name, 'replenishment_recommendations'::name),
        ('p1'::name, 'inventory_batches'::name),
        ('pr2'::name, 'purchase_requisitions'::name),
        ('pr2'::name, 'purchase_orders'::name),
        ('pr2'::name, 'invoices'::name),
        ('pr2'::name, 'payment_approvals'::name)
      ) AS required_tables(table_schema, table_name)
    LOOP
      IF to_regclass(format('%I.%I', table_record.table_schema, table_record.table_name)) IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = table_record.table_schema
             AND tablename = table_record.table_name
         ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I',
          table_record.table_schema,
          table_record.table_name
        );
      END IF;
    END LOOP;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime is not available; enable Realtime in Supabase before applying this migration.';
  END IF;
END
$$;
