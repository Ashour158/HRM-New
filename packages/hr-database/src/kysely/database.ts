import { Kysely, PostgresDialect } from 'kysely';
import type { Pool } from 'pg';
import { TenantFilterPlugin } from '../plugins/tenant-plugin.js';
import { maybeTenantBoundPool } from '../connection/rls-pool.js';
import { getSystemPool } from '../connection/pool.js';
import type { Database } from '../types/platform-tables.js';

export type { Database };

export function createKyselyInstance(pool: Pool): Kysely<Database> {
  // When DB_RLS_ENABLED is on, bind the request tenant onto each pooled
  // connection so Postgres RLS policies take effect. Inert (returns the pool
  // unchanged) when the flag is off, preserving pre-RLS behavior.
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: maybeTenantBoundPool(pool) }),
    plugins: [new TenantFilterPlugin()],
  });
}

/**
 * Kysely instance for cross-tenant background work. Uses the system pool
 * ({@link getSystemPool}) and deliberately does NOT apply the tenant-binding
 * connection wrapper: under RLS the system pool connects as the `hcm_system`
 * (BYPASSRLS) role and must see/write across tenants. The TenantFilterPlugin is
 * still attached, so app-layer scoping still applies whenever a worker runs
 * inside a `runWithTenant` context.
 */
export function createSystemKyselyInstance(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: getSystemPool() }),
    plugins: [new TenantFilterPlugin()],
  });
}
