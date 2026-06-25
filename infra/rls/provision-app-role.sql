-- Provision the restricted runtime role for Row-Level Security.
-- Run ONCE as a superuser (e.g. hcm_admin) before activating RLS.
--
-- RLS is ignored for superusers and table owners. The application must therefore
-- connect as this NON-superuser, NON-owner role for tenant_isolation policies to
-- take effect. Replace :app_password before running (do not commit a real secret).
--
--   psql "$ADMIN_DATABASE_URL" -v app_password="'<strong-password>'" -f provision-app-role.sql

-- 1. Application role used by hr-api at runtime (subject to RLS).
-- (psql variables are NOT interpolated inside dollar-quoted DO blocks, so the
-- role is created via a generated statement + \gexec, which interpolates
-- `:'app_password'` correctly and runs only when the role is missing.)
SELECT format('CREATE ROLE hcm_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hcm_app')\gexec

GRANT USAGE ON SCHEMA hr_core, hr_org, hr_er, hr_ai, hr_wfm, hr_platform TO hcm_app;
-- Grant on every hr_* schema; extend this list to match deployed schemas.

-- DML on existing tables in hr_* schemas.
DO $$
DECLARE s RECORD;
BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'hr\_%'
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO hcm_app', s.schema_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO hcm_app', s.schema_name);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO hcm_app', s.schema_name);
    -- Future tables/sequences created by the migration owner.
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hcm_app', s.schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO hcm_app', s.schema_name);
  END LOOP;
END $$;

-- 2. Optional system role for cross-tenant background jobs (outbox dispatcher,
--    scheduler, tenant onboarding). BYPASSRLS lets these operate across tenants.
--    Keep its use narrow and audited.
SELECT format('CREATE ROLE hcm_system LOGIN BYPASSRLS PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hcm_system')\gexec
