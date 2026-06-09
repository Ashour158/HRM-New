import { describe, expect, it } from 'vitest';
import {
  clearAuthSession,
  persistAuthSession,
  readAuthToken,
  readRefreshToken,
  readTenantId,
} from './auth-storage';

describe('auth storage', () => {
  it('stores auth tokens in session storage instead of durable local storage', () => {
    persistAuthSession({
      token: 'access-token',
      refreshToken: 'refresh-token',
      tenantId: 'tenant-1',
    });

    expect(readAuthToken()).toBe('access-token');
    expect(readRefreshToken()).toBe('refresh-token');
    expect(readTenantId()).toBe('tenant-1');
    expect(window.sessionStorage.getItem('auth_token')).toBe('access-token');
    expect(window.localStorage.getItem('auth_token')).toBeNull();
    expect(window.localStorage.getItem('refresh_token')).toBeNull();
    expect(window.localStorage.getItem('auth-storage')).toBeNull();
  });

  it('clears both session tokens and legacy local storage auth residue', () => {
    window.localStorage.setItem('auth_token', 'legacy-token');
    window.localStorage.setItem('refresh_token', 'legacy-refresh');
    persistAuthSession({ token: 'token', refreshToken: 'refresh', tenantId: 'tenant-1' });

    clearAuthSession();

    expect(readAuthToken()).toBeNull();
    expect(readRefreshToken()).toBeNull();
    expect(window.sessionStorage.getItem('auth_token')).toBeNull();
    expect(window.localStorage.getItem('auth_token')).toBeNull();
    expect(window.localStorage.getItem('refresh_token')).toBeNull();
  });
});
