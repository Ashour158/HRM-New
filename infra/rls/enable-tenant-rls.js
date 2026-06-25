/**
 * Tenant Row-Level Security policies — STAGED ARTIFACT, NOT AUTO-APPLIED.
 *
 * This file lives in infra/rls/ (NOT infra/migrations/) on purpose: enabling RLS
 * must be coordinated with two operational prerequisites, or every query breaks:
 *
 *   1. The runtime must connect as a NON-superuser, NON-owner role. Today the app
 *      connects as `hcm_admin` (POSTGRES_USER), a superuser that BYPASSES RLS even
 *      with FORCE. Provision a restricted role and point DATABASE_URL at it first.
 *   2. `DB_RLS_ENABLED=true` so the connection wrapper sets `app.current_tenant`
 *      on every checkout (packages/hr-database/src/connection/rls-pool.ts).
 *
 * Activation sequence: provision role → grants → set DB_RLS_ENABLED=true → move
 * this file into infra/migrations/ with a timestamp prefix → run migrations →
 * switch DATABASE_URL to the restricted role. Roll back with the down migration
 * (or `DB_RLS_ENABLED=false` + revert DATABASE_URL) at any point.
 *
 * The policy is generated dynamically for every table in an `hr_*` schema that has
 * a `tenant_id` column, so no table on the ~69-migration surface is missed.
 */

const POLICY = 'tenant_isolation';
// Cover EVERY tenant_id table regardless of schema (most are hr_*, but a few admin
// tables live in `public`). Only system catalogs are excluded; the tenant_id column
// filter already restricts the set to tenant-owned tables.
const SYSTEM_SCHEMAS = ['pg_catalog', 'information_schema'];
// Cross-tenant tables that must NOT be tenant-scoped (platform-global / dispatcher).
const EXEMPT_TABLES = ['tenants'];

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN
        SELECT c.table_schema, c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.column_name = 'tenant_id'
          AND t.table_type = 'BASE TABLE'
          AND c.table_schema <> ALL ('{${SYSTEM_SCHEMAS.join(',')}}')
          AND c.table_name <> ALL ('{${EXEMPT_TABLES.join(',')}}')
      LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.table_schema, r.table_name);
        EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.table_schema, r.table_name);
        EXECUTE format('DROP POLICY IF EXISTS ${POLICY} ON %I.%I', r.table_schema, r.table_name);
        EXECUTE format(
          'CREATE POLICY ${POLICY} ON %I.%I '
          'USING (tenant_id = current_setting(''app.current_tenant'', true)::uuid) '
          'WITH CHECK (tenant_id = current_setting(''app.current_tenant'', true)::uuid)',
          r.table_schema, r.table_name
        );
      END LOOP;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN
        SELECT c.table_schema, c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.column_name = 'tenant_id'
          AND t.table_type = 'BASE TABLE'
          AND c.table_schema <> ALL ('{${SYSTEM_SCHEMAS.join(',')}}')
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS ${POLICY} ON %I.%I', r.table_schema, r.table_name);
        EXECUTE format('ALTER TABLE %I.%I NO FORCE ROW LEVEL SECURITY', r.table_schema, r.table_name);
        EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY', r.table_schema, r.table_name);
      END LOOP;
    END $$;
  `);
};
