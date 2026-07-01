import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_SYSTEM_URL = process.env.SYSTEM_DATABASE_URL;
const ORIGINAL_POOL_MAX = process.env.DB_POOL_MAX;
const ORIGINAL_SYSTEM_POOL_MAX = process.env.DB_SYSTEM_POOL_MAX;

describe('getSystemPool', () => {
  afterEach(() => {
    if (ORIGINAL_SYSTEM_URL === undefined) delete process.env.SYSTEM_DATABASE_URL;
    else process.env.SYSTEM_DATABASE_URL = ORIGINAL_SYSTEM_URL;
    if (ORIGINAL_POOL_MAX === undefined) delete process.env.DB_POOL_MAX;
    else process.env.DB_POOL_MAX = ORIGINAL_POOL_MAX;
    if (ORIGINAL_SYSTEM_POOL_MAX === undefined) delete process.env.DB_SYSTEM_POOL_MAX;
    else process.env.DB_SYSTEM_POOL_MAX = ORIGINAL_SYSTEM_POOL_MAX;
    vi.resetModules();
  });

  it('falls back to the main pool when SYSTEM_DATABASE_URL is unset (default/RLS-off path)', async () => {
    delete process.env.SYSTEM_DATABASE_URL;
    vi.resetModules();
    const { getPool, getSystemPool } = await import('./pool.js');
    expect(getSystemPool()).toBe(getPool());
  });

  it('returns a distinct, stable pool when SYSTEM_DATABASE_URL is set', async () => {
    process.env.SYSTEM_DATABASE_URL = 'postgresql://hcm_system:pw@localhost:5434/hcm_platform';
    vi.resetModules();
    const { getPool, getSystemPool } = await import('./pool.js');
    const systemPool = getSystemPool();
    expect(systemPool).not.toBe(getPool());
    // Singleton: repeated calls return the same instance.
    expect(getSystemPool()).toBe(systemPool);
  });

  it('sizes the system pool independently from the main pool via DB_SYSTEM_POOL_MAX', async () => {
    process.env.SYSTEM_DATABASE_URL = 'postgresql://hcm_system:pw@localhost:5434/hcm_platform';
    process.env.DB_POOL_MAX = '20';
    process.env.DB_SYSTEM_POOL_MAX = '4';
    vi.resetModules();
    const { getSystemPool } = await import('./pool.js');
    expect(getSystemPool().options.max).toBe(4);
  });

  it('falls back to DB_POOL_MAX for the system pool when DB_SYSTEM_POOL_MAX is unset', async () => {
    process.env.SYSTEM_DATABASE_URL = 'postgresql://hcm_system:pw@localhost:5434/hcm_platform';
    process.env.DB_POOL_MAX = '12';
    delete process.env.DB_SYSTEM_POOL_MAX;
    vi.resetModules();
    const { getSystemPool } = await import('./pool.js');
    expect(getSystemPool().options.max).toBe(12);
  });
});
