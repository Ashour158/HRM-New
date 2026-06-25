import { afterEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockIsRlsEnabled = vi.fn();

vi.mock('@hcm/database', () => ({
  getPool: () => ({ query: mockQuery }),
  isRlsEnabled: () => mockIsRlsEnabled(),
}));

import { assertRlsRuntimeSafety } from './rls-runtime-check.js';

describe('assertRlsRuntimeSafety', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SYSTEM_DATABASE_URL;
  });

  it('is a no-op when RLS is disabled', async () => {
    mockIsRlsEnabled.mockReturnValue(false);
    await expect(assertRlsRuntimeSafety()).resolves.toBeUndefined();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('throws when RLS is on but SYSTEM_DATABASE_URL is missing', async () => {
    mockIsRlsEnabled.mockReturnValue(true);
    await expect(assertRlsRuntimeSafety()).rejects.toThrow(/SYSTEM_DATABASE_URL/);
  });

  it('throws when the request role is a superuser (silent bypass)', async () => {
    mockIsRlsEnabled.mockReturnValue(true);
    process.env.SYSTEM_DATABASE_URL = 'postgresql://hcm_system:x@localhost:5434/db';
    mockQuery.mockResolvedValue({ rows: [{ rolsuper: true, rolbypassrls: false, current_user: 'hcm_admin' }] });
    await expect(assertRlsRuntimeSafety()).rejects.toThrow(/superuser/);
  });

  it('throws when the request role is BYPASSRLS', async () => {
    mockIsRlsEnabled.mockReturnValue(true);
    process.env.SYSTEM_DATABASE_URL = 'postgresql://hcm_system:x@localhost:5434/db';
    mockQuery.mockResolvedValue({ rows: [{ rolsuper: false, rolbypassrls: true, current_user: 'hcm_system' }] });
    await expect(assertRlsRuntimeSafety()).rejects.toThrow(/BYPASSRLS/);
  });

  it('resolves for a non-superuser, non-bypass role with the system pool set', async () => {
    mockIsRlsEnabled.mockReturnValue(true);
    process.env.SYSTEM_DATABASE_URL = 'postgresql://hcm_system:x@localhost:5434/db';
    mockQuery.mockResolvedValue({ rows: [{ rolsuper: false, rolbypassrls: false, current_user: 'hcm_app' }] });
    await expect(assertRlsRuntimeSafety()).resolves.toBeUndefined();
  });
});
