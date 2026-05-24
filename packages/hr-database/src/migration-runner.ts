import { runner } from 'node-pg-migrate';
import { getPool } from './connection/pool.js';

export async function runMigrations(direction: 'up' | 'down', count?: number): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await runner({
      dbClient: client,
      direction,
      count,
      dir: 'migrations',
      migrationsTable: 'pgmigrations',
    });
  } finally {
    client.release();
  }
}
