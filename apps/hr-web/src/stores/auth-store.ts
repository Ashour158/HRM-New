import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User, Role, Permission } from '@/types';
import { clearAuthSession, persistAuthSession, readAuthToken, readRefreshToken } from '@/lib/auth-storage';

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
  refreshToken: string | null;
  login: (user: User, token: string, refreshToken?: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
}

/**
 * Zustand store for authentication state.
 * Persists only user context to sessionStorage; bearer tokens stay outside durable localStorage.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      roles: [],
      permissions: [],
      isAuthenticated: false,
      isLoading: true,
      token: readAuthToken(),
      refreshToken: readRefreshToken(),

      login: (user: User, token: string, refreshToken?: string) => {
        persistAuthSession({ token, refreshToken, tenantId: user.tenantId });
        set({
          user,
          roles: user.roles,
          permissions: user.permissions,
          isAuthenticated: true,
          isLoading: false,
          token,
          refreshToken: refreshToken ?? null,
        });
      },

      logout: () => {
        clearAuthSession();
        set({
          user: null,
          roles: [],
          permissions: [],
          isAuthenticated: false,
          isLoading: false,
          token: null,
          refreshToken: null,
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
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
