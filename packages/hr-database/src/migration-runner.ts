import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runner } from 'node-pg-migrate';
import { getPool } from './connection/pool.js';

// Resolve infra/migrations relative to this module so the runner works
// regardless of the process CWD (this file lives in src/ or dist/, both one
// level under the package root, so infra is three levels up).
const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../infra/migrations');

export async function runMigrations(direction: 'up' | 'down', count?: number): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await runner({
      dbClient: client,
      direction,
      count,
      dir: migrationsDir,
      migrationsTable: 'pgmigrations',
    });
  } finally {
    client.release();
  }
}
