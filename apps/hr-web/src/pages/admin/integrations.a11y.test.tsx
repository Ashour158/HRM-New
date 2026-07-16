import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminIntegrations } from './integrations';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

const statusAdapters = [
  {
    adapterName: 'email-smtp',
    direction: 'OUTBOUND',
    state: 'HEALTHY',
    lastSuccessAt: '2026-06-10T09:00:00.000Z',
    lastFailureAt: undefined,
    consecutiveFailures: 0,
    totalSuccesses: 42,
    totalFailures: 1,
  },
];

const readinessAdapters = [
  {
    adapterName: 'email-smtp',
    direction: 'OUTBOUND',
    credentialState: 'CONFIGURED',
    ready: true,
    blockers: [],
    owner: { team: 'Platform', contact: 'platform@acme.test' },
    environments: [
      { name: 'SANDBOX', credentialState: 'CONFIGURED' },
      { name: 'PRODUCTION', credentialState: 'CONFIGURED' },
    ],
    retryPolicy: { maxAttempts: 5, backoff: 'EXPONENTIAL', deadLetterAfterAttempts: 5 },
    auditLogHooks: [],
    incident: { state: 'NONE' },
  },
];

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminIntegrations accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/hr/integrations/status') return apiResponse({ adapters: statusAdapters });
      if (url === '/hr/integrations/readiness') return apiResponse({ adapters: readinessAdapters });
      if (url.startsWith('/hr/integrations/') && url.endsWith('/metrics')) {
        return apiResponse({
          adapterName: 'email-smtp',
          totalCalls: 100,
          successfulCalls: 98,
          failedCalls: 2,
          averageLatencyMs: 120,
          lastCallAt: '2026-06-10T09:00:00.000Z',
          p95LatencyMs: 200,
          p99LatencyMs: 300,
        });
      }
      return apiResponse({});
    });
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminIntegrations />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'System Control - Integrations' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/hr/integrations/status'));
    await waitFor(() => expect(screen.getAllByText('email-smtp').length).toBeGreaterThan(0));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
