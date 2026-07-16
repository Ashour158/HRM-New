import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDeadLetterEvents } from './dead-letter-events';

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

const summary = {
  generatedAt: '2026-06-10T09:00:00.000Z',
  inbox: {
    failedRetryable: 2,
    failedNonRetryable: 1,
    inProgress: 0,
    skipped: 0,
    success: 40,
    totalNonSuccess: 3,
  },
  outbox: {
    pending: 1,
    exhausted: 1,
    operatorSkipped: 0,
    published: 30,
    totalUnresolved: 2,
  },
};

const inboxRows = [
  {
    queue: 'inbox',
    id: '00000000-0000-0000-0000-000000000301',
    status: 'FAILED_NON_RETRYABLE',
    consumerName: 'payroll-ledger-sync',
    consumerVersion: '1',
    sourceEventId: '00000000-0000-0000-0000-000000000401',
    sourceTopic: 'hcm.payroll.v1',
    eventName: 'PayrollLedgerPosted',
    aggregateType: 'PayrollRun',
    aggregateId: '00000000-0000-0000-0000-000000000501',
    retryCount: 5,
    nextRetryAt: null,
    errorSummary: 'Ledger account not found',
    processedAt: null,
    createdAt: '2026-06-09T09:00:00.000Z',
  },
];

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminDeadLetterEvents accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/admin/dead-letter/summary') return apiResponse(summary);
      if (url === '/admin/dead-letter/inbox') return apiResponse(inboxRows);
      if (url === '/admin/dead-letter/outbox') return apiResponse([]);
      return apiResponse([]);
    });
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminDeadLetterEvents />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Dead-Letter Events' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/admin/dead-letter/summary'));
    await screen.findByText('PayrollLedgerPosted');
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
