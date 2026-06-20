import { Kysely, PostgresDialect } from 'kysely';
import type { Pool } from 'pg';
import { TenantFilterPlugin } from '../plugins/tenant-plugin.js';
import { maybeTenantBoundPool } from '../connection/rls-pool.js';
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
