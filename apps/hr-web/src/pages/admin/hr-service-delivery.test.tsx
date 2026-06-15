import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminHrServiceDelivery } from './hr-service-delivery';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-4000-8000-000000000001';
const caseId = '00000000-0000-4000-8000-000000000501';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenantId,
    tenantName: 'Acme Health',
    tenantConfig: {
      currency: 'AED',
      dateFormat: 'DD/MM/YYYY',
      timezone: 'Asia/Dubai',
      features: [],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderAdminServiceDelivery() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminHrServiceDelivery />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminHrServiceDelivery', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/hr-service-delivery/cases/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: caseId,
            caseNumber: 'HR-20260614-ABC12345',
            requesterWorkerId: '00000000-0000-4000-8000-000000000111',
            caseType: 'PAYROLL_HELP',
            priority: 'HIGH',
            description: 'Payslip deduction looks wrong.',
            assignedTo: '00000000-0000-4000-8000-000000000222',
            slaDeadline: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            status: 'OPEN',
            createdAt: '2026-06-14T08:00:00.000Z',
            updatedAt: '2026-06-14T08:00:00.000Z',
          },
        ]);
      }
      if (url === '/hr-service-delivery/catalog-items') {
        return apiResponse([{ id: 'catalog-1', serviceCode: 'PAYROLL_HELP', serviceName: 'Payroll help', category: 'Payroll', slaHours: 24, status: 'ACTIVE' }]);
      }
      return apiResponse([]);
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { id: caseId } } });
  });

  it('loads the tenant service case queue with SLA-aware triage data', async () => {
    renderAdminServiceDelivery();

    expect(await screen.findByRole('heading', { name: 'HR Service Delivery' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Case Queue' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Catalog' })).toBeInTheDocument();

    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(`/hr-service-delivery/cases/tenant/${tenantId}`));
    expect(await screen.findByText('HR-20260614-ABC12345')).toBeInTheDocument();
    expect(screen.getAllByText('SLA breached').length).toBeGreaterThan(0);
    expect(screen.getByText('PAYROLL HELP')).toBeInTheDocument();
  });

  it('runs case lifecycle commands from the queue', async () => {
    renderAdminServiceDelivery();

    expect(await screen.findByText('HR-20260614-ABC12345')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start work' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/hr-service-delivery/cases/${caseId}/commands/mark-in-progress`,
      {},
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Case updated' }));
  });
});
