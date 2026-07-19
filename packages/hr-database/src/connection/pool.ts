import { Pool, types } from 'pg';

/**
 * NUMERIC/DECIMAL (OID 1700) columns hold arbitrary-precision decimal values
 * (money, rates) that a JS `number` (IEEE 754 double) cannot always represent
 * exactly. node-postgres already returns these as strings by default for
 * this reason -- this registration doesn't change that behavior, it makes it
 * explicit and centralizes the OID mapping in one documented place instead
 * of relying on an implicit, easy-to-miss driver default. Application code
 * must convert deliberately at each use site (Number()/parseFloat() for
 * display, the Money value object for precision-sensitive arithmetic) --
 * see packages/hr-database/src/types/platform-tables.ts, where every
 * NUMERIC column is typed `string`, not `number`, to make that conversion a
 * compile-time requirement rather than a silent runtime string-concatenation
 * bug (the actual P0 this registration exists to prevent regressing).
 */
types.setTypeParser(1700, (value: string) => value);

let pool: Pool | null = null;
let systemPool: Pool | null = null;

function buildPool(connectionString: string | undefined, appName: string, max: number): Pool {
  const p = new Pool({
    connectionString,
    max,
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
    pool = buildPool(
      process.env.DATABASE_URL,
      process.env.DB_APPLICATION_NAME ?? 'hcm-database',
      Number(process.env.DB_POOL_MAX ?? 20),
    );
  }
  return pool;
}

/**
 * Pool for cross-tenant background work (outbox dispatcher, inbox recovery,
 * scheduler, tenant onboarding). When `SYSTEM_DATABASE_URL` is set it connects as
 * the dedicated `hcm_system` (BYPASSRLS) role so those jobs can operate across all
 * tenants once RLS is enforced on the request pool. When it is NOT set (dev / RLS
 * off) it transparently returns the regular pool, so behavior is unchanged.
 *
 * Sized independently from the main request pool (DB_SYSTEM_POOL_MAX, falling back
 * to DB_POOL_MAX if unset for backward compatibility): background jobs run at much
 * lower concurrency than the request path, and every pod opens BOTH pools once RLS
 * is on, so treating them as the same size silently doubles the real per-pod
 * connection budget used for capacity planning (see deploy/k8s/base/configmap.yaml).
 */
export function getSystemPool(): Pool {
  const systemUrl = process.env.SYSTEM_DATABASE_URL;
  if (!systemUrl) return getPool();
  if (!systemPool) {
    const max = Number(process.env.DB_SYSTEM_POOL_MAX ?? process.env.DB_POOL_MAX ?? 20);
    systemPool = buildPool(systemUrl, `${process.env.DB_APPLICATION_NAME ?? 'hcm-database'}-system`, max);
  }
  return systemPool;
}
