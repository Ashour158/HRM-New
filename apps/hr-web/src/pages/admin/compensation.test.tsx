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

  it('blocks creating a plan with an empty name and shows an inline error', async () => {
    renderCompensation();

    expect(await screen.findByText('Annual merit plan')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Create Plan' }));
    await userEvent.clear(screen.getByLabelText('Plan name'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Plan' }));

    expect(await screen.findByText('Plan name is required')).toBeInTheDocument();
    expect(apiClientPostMock).not.toHaveBeenCalled();
  });

  it('blocks creating a band with non-numeric salary values and shows an inline error', async () => {
    renderCompensation();

    expect(await screen.findByText('Annual merit plan')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Bands' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create Band' }));

    await userEvent.clear(screen.getByLabelText('Minimum salary'));
    await userEvent.type(screen.getByLabelText('Minimum salary'), 'not-a-number');
    await userEvent.click(screen.getByRole('button', { name: 'Save Band' }));

    expect(await screen.findByText('Enter a valid number')).toBeInTheDocument();
    expect(apiClientPostMock).not.toHaveBeenCalled();
  });

  it('creates a band with the exact same payload shape as before once validation passes', async () => {
    renderCompensation();

    expect(await screen.findByText('Annual merit plan')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Bands' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create Band' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Band' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/hr/compensation/bands',
      expect.objectContaining({
        bandCode: 'BAND-001',
        jobLevel: 'L3',
        jobFamily: 'Operations',
        minSalary: 50000,
        midSalary: 65000,
        maxSalary: 80000,
        currency: 'AED',
      }),
    ));
  });
});
