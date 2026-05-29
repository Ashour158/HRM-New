import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role, Permission } from '@/types';

/**
 * Authentication store state and actions.
 */
interface AuthState {
  user: User | null;
  roles: Role[];
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
}

/**
 * Zustand store for authentication state.
 * Persists user and token to localStorage.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      roles: [],
      permissions: [],
      isAuthenticated: false,
      isLoading: true,
      token: null,

      login: (user: User, token: string) => {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('tenant_id', user.tenantId);
        set({
          user,
          roles: user.roles,
          permissions: user.permissions,
          isAuthenticated: true,
          isLoading: false,
          token,
        });
      },

      logout: () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('tenant_id');
        set({
          user: null,
          roles: [],
          permissions: [],
          isAuthenticated: false,
          isLoading: false,
          token: null,
        });
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      updateUser: (userUpdate: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userUpdate } : null,
          roles: userUpdate.roles ?? state.roles,
          permissions: userUpdate.permissions ?? state.permissions,
        })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
