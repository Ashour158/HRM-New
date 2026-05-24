import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import type { User } from '@/types';

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
  }, [token, user, logout, setLoading]);

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
