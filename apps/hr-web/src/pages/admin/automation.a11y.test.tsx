import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAutomation } from './automation';

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

const schedulerSummary = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  generatedAt: '2026-06-14T01:00:00.000Z',
  jobs: [
    {
      name: 'leave-accrual-run',
      defaultCron: '0 5 1 * *',
      effectiveCron: '0 6 1 * *',
      enabled: false,
      concurrency: 'per-tenant',
      permissions: ['SCHEDULER_RUN'],
      tenantOverride: {
        tenantId: '00000000-0000-4000-8000-000000000001',
        jobName: 'leave-accrual-run',
        cron: '0 6 1 * *',
        enabled: false,
      },
      lastRun: {
        id: 'run-1',
        tenantId: '00000000-0000-4000-8000-000000000001',
        jobName: 'leave-accrual-run',
        periodKey: '2026-06',
        status: 'FAILED',
        itemsProcessed: 3,
        error: 'policy missing',
        startedAt: '2026-06-14T01:00:00.000Z',
        finishedAt: '2026-06-14T01:01:00.000Z',
      },
    },
    {
      name: 'scheduled-report-generation',
      defaultCron: '*/15 * * * *',
      effectiveCron: '*/15 * * * *',
      enabled: true,
      concurrency: 'global',
      permissions: ['REPORT_RUN'],
      tenantOverride: null,
      lastRun: null,
    },
  ],
};

function renderAutomation() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  apiClientGetMock.mockResolvedValue({ data: { success: true, data: schedulerSummary } });
  apiClientPostMock.mockResolvedValue({ data: { success: true, data: { jobName: 'leave-accrual-run', tenants: [] } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminAutomation />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminAutomation accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderAutomation();

    expect(await screen.findByRole('heading', { name: 'Automation' })).toBeInTheDocument();
    expect(await screen.findByText('leave-accrual-run')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
