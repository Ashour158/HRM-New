import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('AdminAutomation', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
  });

  it('lists scheduler jobs with override, last run health, and operator actions', async () => {
    renderAutomation();

    expect(await screen.findByRole('heading', { name: 'Automation' })).toBeInTheDocument();
    expect(await screen.findByText('leave-accrual-run')).toBeInTheDocument();
    expect(screen.getByText('0 5 1 * *')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('policy missing')).toBeInTheDocument();
    expect(screen.getByLabelText('Enabled for leave-accrual-run')).not.toBeChecked();

    await userEvent.clear(screen.getByLabelText('Cron for leave-accrual-run'));
    await userEvent.type(screen.getByLabelText('Cron for leave-accrual-run'), '0 7 1 * *');
    await userEvent.click(screen.getByLabelText('Enabled for leave-accrual-run'));
    await userEvent.click(screen.getByRole('button', { name: 'Save leave-accrual-run schedule' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/platform/scheduler/jobs/leave-accrual-run/schedule',
      expect.objectContaining({
        tenantId: schedulerSummary.tenantId,
        cron: '0 7 1 * *',
        enabled: true,
      }),
    ));

    await userEvent.click(screen.getByRole('button', { name: 'Run leave-accrual-run now' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/platform/scheduler/jobs/leave-accrual-run/run',
      { tenantId: schedulerSummary.tenantId },
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Schedule saved',
      type: 'success',
    }));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Automation run started',
      type: 'success',
    }));
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderAutomation();

    expect(await screen.findByText('scheduled-report-generation')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
