import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { HomePage } from './home';

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

const inbox = {
  generatedAt: '2026-06-15T10:00:00.000Z',
  sections: [
    {
      key: 'approvals',
      title: 'Approvals',
      count: 1,
      items: [
        {
          id: 'approval-1',
          title: 'ApproveAbsenceRequest',
          subtitle: 'Manager review',
          severity: 'OVERDUE',
          deepLink: '/manager/approvals?chain=approval-1',
          actions: [
            {
              label: 'Approve',
              commandPath: '/platform/workflow/approval-chains/approval-1/steps/step-1/commands/approve',
              body: { reason: 'Approved from For You' },
            },
          ],
        },
      ],
    },
    {
      key: 'notifications',
      title: 'Notifications',
      count: 1,
      items: [
        {
          id: 'notification-1',
          title: 'Payslip published',
          subtitle: 'June payroll is ready',
          severity: 'INFO',
          deepLink: '/employee/payslip',
        },
      ],
    },
  ],
};

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  apiClientGetMock.mockResolvedValue({ data: { success: true, data: inbox } });
  apiClientPostMock.mockResolvedValue({ data: { success: true, data: { status: 'APPROVED' } } });

  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
  });

  it('shows a proactive For You feed and executes inline command actions', async () => {
    renderHome();

    expect(await screen.findByRole('heading', { name: 'For You' })).toBeInTheDocument();
    expect(await screen.findByText('ApproveAbsenceRequest')).toBeInTheDocument();
    expect(screen.getByText('Payslip published')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Approve ApproveAbsenceRequest' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/platform/workflow/approval-chains/approval-1/steps/step-1/commands/approve',
      { reason: 'Approved from For You' },
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Action completed',
      type: 'success',
    }));
  });
});
