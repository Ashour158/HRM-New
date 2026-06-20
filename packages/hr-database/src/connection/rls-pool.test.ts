import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { Uuid } from '@hcm/shared-kernel';
import { runWithTenant } from './tenant-context.js';
import {
  createTenantBoundPool,
  isRlsEnabled,
  maybeTenantBoundPool,
  NIL_TENANT_ID,
} from './rls-pool.js';

const tenant = new Uuid('00000000-0000-4000-8000-000000000abc');

function fakePool() {
  const release = vi.fn();
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const client = { query, release } as unknown as PoolClient;
  const connect = vi.fn().mockResolvedValue(client);
  const pool = { connect } as unknown as Pool;
  return { pool, client, query, release, connect };
}

afterEach(() => {
  delete process.env.DB_RLS_ENABLED;
});

describe('isRlsEnabled', () => {
  it('is off unless DB_RLS_ENABLED is true/1', () => {
    expect(isRlsEnabled()).toBe(false);
    process.env.DB_RLS_ENABLED = 'true';
    expect(isRlsEnabled()).toBe(true);
    process.env.DB_RLS_ENABLED = '1';
    expect(isRlsEnabled()).toBe(true);
    process.env.DB_RLS_ENABLED = 'no';
    expect(isRlsEnabled()).toBe(false);
  });
});

describe('maybeTenantBoundPool', () => {
  it('returns the pool unchanged when the flag is off', () => {
    const { pool, connect } = fakePool();
    expect(maybeTenantBoundPool(pool).connect).toBe(connect);
  });
});

describe('createTenantBoundPool', () => {
  it('sets the GUC to the ALS tenant on checkout', async () => {
    const { pool, query } = fakePool();
    createTenantBoundPool(pool);

    await runWithTenant(tenant, async () => {
      await pool.connect();
    });

    expect(query).toHaveBeenCalledWith("SELECT set_config('app.current_tenant', $1, false)", [tenant.value]);
  });

  it('fails closed to the nil tenant when no ALS tenant is set', async () => {
    const { pool, query } = fakePool();
    createTenantBoundPool(pool);

    await pool.connect();

    expect(query).toHaveBeenCalledWith("SELECT set_config('app.current_tenant', $1, false)", [NIL_TENANT_ID]);
  });

  it('resets the GUC before returning the connection to the pool', async () => {
    const { pool, query, release } = fakePool();
    createTenantBoundPool(pool);

    const client = await runWithTenant(tenant, async () => pool.connect());
    query.mockClear();
    client.release();
    await vi.waitFor(() => expect(release).toHaveBeenCalled());

    expect(query).toHaveBeenCalledWith('RESET app.current_tenant');
  });

  it('is idempotent — wrapping twice does not double-bind', () => {
    const { pool } = fakePool();
    const once = createTenantBoundPool(pool).connect;
    const twice = createTenantBoundPool(pool).connect;
    expect(once).toBe(twice);
  });
});
