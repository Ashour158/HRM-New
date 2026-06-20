import type { Pool, PoolClient } from 'pg';
import { getCurrentTenantId } from './tenant-context.js';

/**
 * Connection-level tenant binding for Postgres Row-Level Security (RLS).
 *
 * RLS policies filter on `current_setting('app.current_tenant')::uuid`. That GUC
 * must be set on the *same* connection that runs each query. Because the app uses
 * a shared pool (connection-per-query, no request-scoped transaction), we bind the
 * tenant at connection checkout and reset it on release so a pooled connection can
 * never carry a stale tenant to the next caller.
 *
 * Fail-closed: when no tenant is present in the AsyncLocalStorage context, the GUC
 * is set to the nil UUID, which matches no tenant's rows (rather than leaving the
 * previous value or disabling the filter). Genuine cross-tenant system jobs must
 * use a dedicated BYPASSRLS role / explicit escape hatch, not an unset tenant.
 *
 * Gated by `DB_RLS_ENABLED`; when off, {@link maybeTenantBoundPool} returns the
 * pool unchanged so behavior is identical to pre-RLS.
 */

/** Nil UUID — matches no tenant row, so an unset tenant yields zero rows. */
export const NIL_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export function isRlsEnabled(): boolean {
  const v = process.env.DB_RLS_ENABLED;
  return v === 'true' || v === '1';
}

/**
 * Wrap a pool so each acquired connection has `app.current_tenant` set from the
 * current ALS tenant, and reset on release. Mutates and returns the same pool.
 */
export function createTenantBoundPool(pool: Pool): Pool {
  const poolWithFlag = pool as Pool & { __rlsBound?: boolean };
  if (poolWithFlag.__rlsBound) return pool;
  poolWithFlag.__rlsBound = true;

  const originalConnect = pool.connect.bind(pool) as (...args: unknown[]) => Promise<PoolClient>;

  (pool as unknown as { connect: (...args: unknown[]) => Promise<PoolClient> }).connect = async (
    ...args: unknown[]
  ): Promise<PoolClient> => {
    const client = await originalConnect(...args);
    const tenantId = getCurrentTenantId()?.value ?? NIL_TENANT_ID;

    try {
      await client.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId]);
    } catch (err) {
      // Could not bind tenant — discard the connection rather than risk an
      // unscoped query.
      client.release(true);
      throw err;
    }

    const originalRelease = client.release.bind(client) as (err?: Error | boolean) => void;
    let released = false;
    (client as unknown as { release: (err?: Error | boolean) => void }).release = (
      err?: Error | boolean,
    ): void => {
      if (released) return;
      released = true;
      // Reset BEFORE returning the connection to the pool so it never carries a
      // stale tenant. If reset fails (async rejection OR a synchronous throw),
      // destroy the connection (truthy arg) so a mis-scoped connection is never
      // reused — and never leak it back to the pool unreleased.
      try {
        client
          .query('RESET app.current_tenant')
          .then(() => originalRelease(err))
          .catch(() => originalRelease(new Error('RLS tenant reset failed; discarding connection')));
      } catch {
        originalRelease(new Error('RLS tenant reset threw; discarding connection'));
      }
    };

    return client;
  };

  return pool;
}

/** Return an RLS-bound pool when the feature flag is on, else the pool unchanged. */
export function maybeTenantBoundPool(pool: Pool): Pool {
  return isRlsEnabled() ? createTenantBoundPool(pool) : pool;
}
