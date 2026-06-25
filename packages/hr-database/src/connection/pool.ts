import { Pool } from 'pg';

let pool: Pool | null = null;
let systemPool: Pool | null = null;

function buildPool(connectionString: string | undefined, appName: string): Pool {
  const p = new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 20),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? 5000),
    // Cap any single statement and abort transactions left idle, so a runaway
    // query or stuck transaction cannot pin a connection indefinitely.
    statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 30000),
    idle_in_transaction_session_timeout: Number(process.env.DB_IDLE_IN_TXN_TIMEOUT_MS ?? 60000),
    application_name: appName,
  });
  p.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Unexpected PostgreSQL pool error', err);
  });
  return p;
}

export function getPool(): Pool {
  if (!pool) {
    pool = buildPool(process.env.DATABASE_URL, process.env.DB_APPLICATION_NAME ?? 'hcm-database');
  }
  return pool;
}

/**
 * Pool for cross-tenant background work (outbox dispatcher, inbox recovery,
 * scheduler, tenant onboarding). When `SYSTEM_DATABASE_URL` is set it connects as
 * the dedicated `hcm_system` (BYPASSRLS) role so those jobs can operate across all
 * tenants once RLS is enforced on the request pool. When it is NOT set (dev / RLS
 * off) it transparently returns the regular pool, so behavior is unchanged.
 */
export function getSystemPool(): Pool {
  const systemUrl = process.env.SYSTEM_DATABASE_URL;
  if (!systemUrl) return getPool();
  if (!systemPool) {
    systemPool = buildPool(systemUrl, `${process.env.DB_APPLICATION_NAME ?? 'hcm-database'}-system`);
  }
  return systemPool;
}
