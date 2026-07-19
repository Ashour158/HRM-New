import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCompensation } from './compensation';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenantId: '00000000-0000-4000-8000-000000000001',
    tenantName: 'Acme Health',
    tenantConfig: {
      currency: 'AED',
      dateFormat: 'DD/MM/YYYY',
      timezone: 'Asia/Dubai',
      features: [],
    },
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: '00000000-0000-4000-8000-000000000099',
      roles: [{ id: 'role-1', name: 'COMPENSATION_ADMIN' }],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

const workerId = '00000000-0000-4000-8000-000000000501';

function renderCompensation() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminCompensation />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminCompensation', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/hr/compensation/plans') {
        return apiResponse([
          {
            id: { value: '00000000-0000-4000-8000-000000000101' },
            name: 'Annual merit plan',
            planType: 'MERIT',
            currency: 'AED',
            status: 'DRAFT',
            effectiveFrom: '2026-01-01T00:00:00.000Z',
          },
        ]);
      }
      if (url === '/hr/compensation/bands') return apiResponse([]);
      if (url === '/hr/compensation/bonus-cycles') return apiResponse([]);
      if (url.endsWith('/allowed-actions')) return apiResponse({ allowedActions: ['ACTIVATE'] });
      if (url === `/hr/core/workers/directory-search?search=ali&pageSize=10`) {
        return apiResponse([
          {
            id: workerId,
            employeeId: 'EMP-2001',
            firstName: 'Alice',
            lastName: 'Nguyen',
            jobTitle: 'Senior Engineer',
          },
        ]);
      }
      if (url === `/hr/compensation/changes/worker/${workerId}`) return apiResponse([]);
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { allowedNextActions: [] } } });
  });

  it('renders compensation tabs and tenant-currency create flow', async () => {
    renderCompensation();

    expect(await screen.findByRole('heading', { name: 'Compensation' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Plans' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bands' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Changes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bonus Cycles' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Equity Grants' })).toBeInTheDocument();
    expect(await screen.findByText('Annual merit plan')).toBeInTheDocument();
    expect(screen.getByText('Tenant currency: AED')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Create Plan' }));
    await userEvent.clear(screen.getByLabelText('Plan name'));
    await userEvent.type(screen.getByLabelText('Plan name'), 'Executive bonus plan');
    await userEvent.click(screen.getByRole('button', { name: 'Save Plan' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/hr/compensation/plans',
      expect.objectContaining({
        name: 'Executive bonus plan',
        currency: 'AED',
      }),
    ));
  });

  it('searches and selects a worker through the worker picker to filter compensation changes', async () => {
    renderCompensation();

    expect(await screen.findByRole('heading', { name: 'Compensation' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Changes' }));

    await userEvent.type(screen.getByLabelText('Filter changes by worker'), 'ali');
    await userEvent.click(await screen.findByText('Alice Nguyen', {}, { timeout: 5000 }));

    expect(screen.getByLabelText('Filter changes by worker')).toHaveValue('Alice Nguyen');
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(`/hr/compensation/changes/worker/${workerId}`), { timeout: 5000 });
  });
});
