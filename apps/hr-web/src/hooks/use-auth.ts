import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import type { User } from '@/types';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const AUTH_BYPASS_ENABLED = import.meta.env.VITE_AUTH_BYPASS === 'true';
const LOCAL_BYPASS_TOKEN = 'local-dev-bypass-token';

const LOCAL_BYPASS_USER: User = {
  id: '00000000-0000-0000-0000-000000000999',
  email: 'hr.admin@example.com',
  firstName: 'HR',
  lastName: 'Admin',
  tenantId: DEFAULT_TENANT_ID,
  roles: [
    { id: 'role-employee', name: 'EMPLOYEE', description: 'Local development employee access' },
    { id: 'role-manager', name: 'MANAGER', description: 'Local development manager access' },
    { id: 'role-hr-admin', name: 'HR_ADMIN', description: 'Local development HR admin access' },
    { id: 'role-recruiter', name: 'RECRUITER', description: 'Local development recruiter access' },
    { id: 'role-payroll-admin', name: 'PAYROLL_ADMIN', description: 'Local development payroll access' },
  ],
  permissions: [
    { id: 'worker-read', resource: 'worker', action: 'read' },
    { id: 'worker-create', resource: 'worker', action: 'create' },
    { id: 'worker-update', resource: 'worker', action: 'update' },
    { id: 'worker-terminate', resource: 'worker', action: 'terminate' },
  ],
};

/**
 * Authentication hook providing user state, roles, permissions, and auth actions.
 * @returns Authentication state and methods
 */
export function useAuth() {
  const { user, roles, permissions, isAuthenticated, isLoading, token, login, logout, setLoading } = useAuthStore();

  /**
   * Authenticates a user with email and password.
   */
  const loginWithCredentials = useCallback(
    async (email: string, password: string, tenantId?: string) => {
      setLoading(true);
      try {
        if (AUTH_BYPASS_ENABLED) {
          const user = { ...LOCAL_BYPASS_USER, email: email || LOCAL_BYPASS_USER.email, tenantId: tenantId || DEFAULT_TENANT_ID };
          login(user, LOCAL_BYPASS_TOKEN);
          return { success: true };
        }

        if (tenantId) {
          localStorage.setItem('tenant_id', tenantId);
        }
        const response = await apiClient.post<{ success: boolean; data: { user: User; token: string } }>(
          '/auth/login',
          { email, password }
        );
        if (response.data.success) {
          login(response.data.data.user, response.data.data.token);
          return { success: true };
        }
        return { success: false, error: 'Login failed' };
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
      logout();
    }
  }, [logout]);

  /**
   * Refreshes the current user profile on mount.
   */
  useEffect(() => {
    if (AUTH_BYPASS_ENABLED) {
      if (!user || token !== LOCAL_BYPASS_TOKEN) {
        login(LOCAL_BYPASS_USER, LOCAL_BYPASS_TOKEN);
      } else {
        setLoading(false);
      }
      return;
    }

    if (token && !user) {
      setLoading(true);
      apiClient
        .get<{ success: boolean; data: User }>('/auth/me')
        .then((res) => {
          if (res.data.success) {
            useAuthStore.getState().updateUser(res.data.data);
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token, user, login, logout, setLoading]);

  return {
    user,
    roles,
    permissions,
    isAuthenticated,
    isLoading,
    login: loginWithCredentials,
    logout: handleLogout,
  };
}
