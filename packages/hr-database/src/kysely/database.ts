import { Kysely, PostgresDialect } from 'kysely';
import type { Pool } from 'pg';
import { TenantFilterPlugin } from '../plugins/tenant-plugin.js';
import type { Database } from '../types/platform-tables.js';

export type { Database };

export function createKyselyInstance(pool: Pool): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new TenantFilterPlugin()],
  });
}
