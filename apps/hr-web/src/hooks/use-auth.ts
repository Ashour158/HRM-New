import { useCallback, useEffect } from 'react';
import type { ApiResponse, AuthLoginResponse, AuthUserResponse } from '@hcm/openapi-contracts';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { persistTenantId } from '@/lib/auth-storage';
import type { User } from '@/types';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const AUTH_BYPASS_ENABLED = import.meta.env.VITE_AUTH_BYPASS === 'true';
const LOCAL_BYPASS_TOKEN = 'local-dev-bypass-token';
const LOCAL_ADMIN_EMAIL = 'hr.admin@example.com';
const LOCAL_MANAGER_EMAIL = 'manager@example.com';
const LOCAL_EMPLOYEE_EMAIL = 'employee@example.com';
const LOCAL_BYPASS_PASSWORD = 'Password123!';
const AUTH_VALIDATION_TIMEOUT_MS = 5000;

let validatedAuthToken: string | null = null;
let validatingAuthToken: string | null = null;
let authValidationPromise: Promise<void> | null = null;

function resetAuthValidation() {
  validatedAuthToken = null;
  validatingAuthToken = null;
  authValidationPromise = null;
}

function localBypassEmailForPath(pathname = window.location.pathname): string {
  if (pathname.startsWith('/employee')) return LOCAL_EMPLOYEE_EMAIL;
  if (pathname.startsWith('/manager')) return LOCAL_MANAGER_EMAIL;
  return LOCAL_ADMIN_EMAIL;
}

async function authenticateWithApi(email: string, password: string, tenantId?: string): Promise<{ user: User; token: string; refreshToken?: string }> {
  if (tenantId) {
    persistTenantId(tenantId);
  }
  const response = await apiClient.post<ApiResponse<AuthLoginResponse>>(
    '/auth/login',
    { email, password }
  );
  if (!response.data.success) {
    throw new Error('Login failed');
  }
  return response.data.data;
}

/**
 * Authentication hook providing user state, roles, permissions, and auth actions.
 * @returns Authentication state and methods
 */
export function useAuth() {
  const { user, roles, permissions, isAuthenticated, isLoading, token, login, logout, setLoading } = useAuthStore();
  const hasPermission = useCallback(
    (permissionCode: string) => permissions.some((permission) => permission.id === permissionCode),
    [permissions],
  );
  const hasAnyPermission = useCallback(
    (permissionCodes: string[]) => permissionCodes.some((permissionCode) => hasPermission(permissionCode)),
    [hasPermission],
  );
  const hasAllPermissions = useCallback(
    (permissionCodes: string[]) => permissionCodes.every((permissionCode) => hasPermission(permissionCode)),
    [hasPermission],
  );

  /**
   * Authenticates a user with email and password.
   */
  const loginWithCredentials = useCallback(
    async (email: string, password: string, tenantId?: string) => {
      setLoading(true);
      try {
        if (AUTH_BYPASS_ENABLED) {
          const credentials = await authenticateWithApi(
            email || localBypassEmailForPath(),
            password || LOCAL_BYPASS_PASSWORD,
            tenantId || DEFAULT_TENANT_ID,
          );
          login(credentials.user, credentials.token, credentials.refreshToken);
          validatedAuthToken = credentials.token;
          validatingAuthToken = null;
          authValidationPromise = null;
          return { success: true };
        }

        const credentials = await authenticateWithApi(email, password, tenantId);
        login(credentials.user, credentials.token, credentials.refreshToken);
        validatedAuthToken = credentials.token;
        validatingAuthToken = null;
        authValidationPromise = null;
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      } finally {
        setLoading(false);
      }
    },
    [login, setLoading]
  );

  /**
   * Logs out the current user and invalidates the session.
   */
  const handleLogout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      resetAuthValidation();
      logout();
    }
  }, [logout]);

  /**
   * Refreshes the current user profile on mount.
   */
  useEffect(() => {
    if (AUTH_BYPASS_ENABLED) {
      const desiredEmail = localBypassEmailForPath();
      if (user?.email === desiredEmail && token && token !== LOCAL_BYPASS_TOKEN) {
        validatedAuthToken = token;
        setLoading(false);
        return;
      }

      let cancelled = false;
      setLoading(true);
      authenticateWithApi(desiredEmail, LOCAL_BYPASS_PASSWORD, DEFAULT_TENANT_ID)
        .then((credentials) => {
          if (cancelled) return;
          login(credentials.user, credentials.token, credentials.refreshToken);
          validatedAuthToken = credentials.token;
          validatingAuthToken = null;
          authValidationPromise = null;
        })
        .catch(() => {
          if (cancelled) return;
          resetAuthValidation();
          logout();
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (!token) {
      if (isAuthenticated || user) {
        logout();
        resetAuthValidation();
      } else {
        setLoading(false);
      }
      return;
    }

    if (validatedAuthToken === token) {
      setLoading(false);
      return;
    }

    if (validatingAuthToken === token && authValidationPromise) {
      return;
    }

    validatingAuthToken = token;
    setLoading(true);

    authValidationPromise = apiClient
      .get<ApiResponse<AuthUserResponse>>('/auth/me', {
        signal: AbortSignal.timeout(AUTH_VALIDATION_TIMEOUT_MS),
      })
      .then((res) => {
        if (res.data.success) {
          validatedAuthToken = token;
          useAuthStore.getState().updateUser(res.data.data);
        } else {
          resetAuthValidation();
          logout();
        }
      })
      .catch(() => {
        resetAuthValidation();
        logout();
      })
      .finally(() => {
        if (validatingAuthToken === token) {
          validatingAuthToken = null;
          authValidationPromise = null;
        }
        setLoading(false);
      });
  }, [isAuthenticated, token, user, login, logout, setLoading]);

  return {
    user,
    roles,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAuthenticated,
    isLoading,
    login: loginWithCredentials,
    logout: handleLogout,
  };
}
