import { create } from 'zustand';
import type { Notification } from '@/types';

/**
 * Modal state definition.
 */
interface ModalState {
  id: string;
  isOpen: boolean;
  data?: Record<string, unknown>;
}

/**
 * UI store state and actions.
 */
interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications: Notification[];
  modals: Record<string, ModalState>;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  dismissNotification: (id: string) => void;
  openModal: (id: string, data?: Record<string, unknown>) => void;
  closeModal: (id: string) => void;
}

/**
 * Zustand store for UI state.
 */
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'system',
  notifications: [],
  modals: {},

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

  setTheme: (theme: 'light' | 'dark' | 'system') => {
    set({ theme });
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  },

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          ...notification,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  dismissNotification: (id: string) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  openModal: (id: string, data?: Record<string, unknown>) =>
    set((state) => ({
      modals: { ...state.modals, [id]: { id, isOpen: true, data } },
    })),

  closeModal: (id: string) =>
    set((state) => ({
      modals: { ...state.modals, [id]: { id, isOpen: false } },
    })),
}));
