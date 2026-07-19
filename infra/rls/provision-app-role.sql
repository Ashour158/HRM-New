-- Provision the restricted runtime role for Row-Level Security.
-- Run ONCE as a superuser (e.g. hcm_admin) before activating RLS.
--
-- RLS is ignored for superusers and table owners. The application must therefore
-- connect as this NON-superuser, NON-owner role for tenant_isolation policies to
-- take effect. Replace :app_password before running (do not commit a real secret).
--
--   psql "$ADMIN_DATABASE_URL" -v app_password="'<strong-password>'" -f provision-app-role.sql

-- 1. Create both runtime roles up front.
--    - hcm_app:    request path, SUBJECT to RLS (non-superuser, non-bypass).
--    - hcm_system: cross-tenant background jobs (outbox/inbox/scheduler/onboarding),
--                  BYPASSRLS so they operate across tenants, plus CREATEDB so the
--                  weekly restore-drill CronJob (deploy/k8s/base/restore-drill-cronjob.yaml),
--                  which authenticates as hcm_system, can CREATE/DROP its own scratch
--                  database for the backup-restore-and-verify check. CREATEDB is the
--                  minimal grant for that pattern — it does not confer superuser or any
--                  additional access to other roles' objects. Keep its use narrow + audited.
-- (psql variables are NOT interpolated inside dollar-quoted DO blocks, so roles are
-- created via generated statements + \gexec, which interpolate `:'app_password'`.)
SELECT format('CREATE ROLE hcm_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hcm_app')\gexec
SELECT format('CREATE ROLE hcm_system LOGIN BYPASSRLS CREATEDB PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hcm_system')\gexec

-- Idempotent safety net: if hcm_system already existed from a prior run of this
-- script (e.g. provisioned before this CREATEDB grant was added), the CREATE ROLE
-- guard above is skipped and the pre-existing role would keep lacking CREATEDB.
-- ALTER ROLE is not conditional in Postgres, but re-applying it is a harmless no-op
-- when the attribute is already set, so it's safe to run unconditionally here.
ALTER ROLE hcm_system CREATEDB;

-- 2. Grant BOTH roles DML on every hr_* schema. (BYPASSRLS skips RLS policies but
--    still needs table-level privileges, so hcm_system is granted too.)
DO $$
DECLARE s RECORD; r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['hcm_app', 'hcm_system'] LOOP
    FOR s IN SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'hr\_%'
    LOOP
      EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', s.schema_name, r);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO %I', s.schema_name, r);
      EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO %I', s.schema_name, r);
      -- Future tables/sequences created by the migration owner.
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', s.schema_name, r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO %I', s.schema_name, r);
    END LOOP;
  END LOOP;
END $$;

-- 3. A few tenant-scoped tables (admin_module_operation_*) live in `public`. Grant both
--    roles on exactly those (NOT public.pgmigrations, which only the migration role
--    touches), per-table so the roles stay least-privilege.
DO $$
DECLARE t RECORD; r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['hcm_app', 'hcm_system'] LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
    FOR t IN
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'tenant_id'
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO %I', t.table_name, r);
    END LOOP;
  END LOOP;
END $$;
