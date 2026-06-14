import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminGlobalHr } from './global-hr';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-4000-8000-000000000001';
const permitId = '00000000-0000-4000-8000-000000000101';
const assignmentId = '00000000-0000-4000-8000-000000000201';

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

function renderAdminGlobalHr() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminGlobalHr />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminGlobalHr', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/global-hr/work-authorization-cases/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: permitId,
            workerId: '00000000-0000-4000-8000-000000000011',
            authorizationType: 'WORK_PERMIT',
            issuingCountry: 'AE',
            documentNumber: 'WP-2026-001',
            validFrom: '2026-01-01T00:00:00.000Z',
            validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'UNDER_REVIEW',
          },
        ]);
      }
      if (url === `/global-hr/international-assignments/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: assignmentId,
            workerId: '00000000-0000-4000-8000-000000000012',
            homeCountry: 'EG',
            hostCountry: 'AE',
            legalEntityId: '00000000-0000-4000-8000-000000000013',
            startDate: '2026-08-01T00:00:00.000Z',
            endDate: '2026-12-01T00:00:00.000Z',
            assignmentReason: 'Regional rollout',
            status: 'APPROVED',
          },
        ]);
      }
      return apiResponse([]);
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { status: 'APPROVED' } } });
  });

  it('shows work permits and international assignments with expiry indicators', async () => {
    renderAdminGlobalHr();

    expect(await screen.findByRole('heading', { name: 'Global HR' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(`/global-hr/work-authorization-cases/tenant/${tenantId}`));
    expect(screen.getByRole('tab', { name: 'Work Permits' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Assignments' })).toBeInTheDocument();
    expect(await screen.findByText('WP-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Expires soon')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Assignments' }));
    expect(await screen.findByText('Regional rollout')).toBeInTheDocument();
    expect(screen.getByText('AE')).toBeInTheDocument();
  });

  it('runs lifecycle commands from the work permit queue', async () => {
    renderAdminGlobalHr();

    expect(await screen.findByText('WP-2026-001')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/global-hr/work-authorization-cases/${permitId}/commands/approve`,
      expect.objectContaining({
        validFrom: expect.any(String),
        validUntil: expect.any(String),
      }),
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Global HR record updated' }));
  });
});
