import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 20),
      idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 30000),
      connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? 5000),
      // Ensure we handle application_name for observability
      application_name: process.env.DB_APPLICATION_NAME ?? 'hcm-database',
    });

    pool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('Unexpected PostgreSQL pool error', err);
    });
  }

  return pool;
}
