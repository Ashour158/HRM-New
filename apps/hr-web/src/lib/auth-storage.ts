const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TENANT_ID_KEY = 'tenant_id';
const AUTH_STORE_KEY = 'auth-storage';

function safeSessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function removeLegacyLocalAuthResidue(): void {
  const storage = safeLocalStorage();
  storage?.removeItem(AUTH_TOKEN_KEY);
  storage?.removeItem(REFRESH_TOKEN_KEY);
  storage?.removeItem(TENANT_ID_KEY);
  storage?.removeItem(AUTH_STORE_KEY);
}

export function persistAuthSession(input: { token?: string; refreshToken?: string; tenantId?: string }): void {
  const storage = safeSessionStorage();
  if (!storage) return;

  if (input.token) storage.setItem(AUTH_TOKEN_KEY, input.token);
  if (input.refreshToken) storage.setItem(REFRESH_TOKEN_KEY, input.refreshToken);
  if (input.tenantId) storage.setItem(TENANT_ID_KEY, input.tenantId);

  removeLegacyLocalAuthResidue();
}

export function persistTenantId(tenantId: string): void {
  safeSessionStorage()?.setItem(TENANT_ID_KEY, tenantId);
  safeLocalStorage()?.removeItem(TENANT_ID_KEY);
}

export function readAuthToken(): string | null {
  return safeSessionStorage()?.getItem(AUTH_TOKEN_KEY) ?? null;
}

export function readRefreshToken(): string | null {
  return safeSessionStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

export function readTenantId(): string | null {
  return safeSessionStorage()?.getItem(TENANT_ID_KEY) ?? null;
}

export function clearAuthSession(): void {
  const storage = safeSessionStorage();
  storage?.removeItem(AUTH_TOKEN_KEY);
  storage?.removeItem(REFRESH_TOKEN_KEY);
  storage?.removeItem(TENANT_ID_KEY);
  storage?.removeItem(AUTH_STORE_KEY);
  removeLegacyLocalAuthResidue();
}
