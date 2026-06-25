import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_SYSTEM_URL = process.env.SYSTEM_DATABASE_URL;

describe('getSystemPool', () => {
  afterEach(() => {
    if (ORIGINAL_SYSTEM_URL === undefined) delete process.env.SYSTEM_DATABASE_URL;
    else process.env.SYSTEM_DATABASE_URL = ORIGINAL_SYSTEM_URL;
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
});
