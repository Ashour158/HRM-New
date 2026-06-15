import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { I18nProvider } from '@/i18n/i18n-provider';
import './index.css';

/**
 * TanStack Query client with default configuration.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Application entry point.
 * Mounts the React 18 root with all providers:
 * - BrowserRouter for routing
 * - QueryClientProvider for data fetching
 * - App component with all layouts and routes
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <I18nProvider>
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </BrowserRouter>
      </I18nProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
