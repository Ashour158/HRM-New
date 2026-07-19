import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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

  it('searches and selects a worker through the worker picker to filter compensation changes', async () => {
    renderCompensation();

    expect(await screen.findByRole('heading', { name: 'Compensation' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Changes' }));

    await userEvent.type(screen.getByLabelText('Filter changes by worker'), 'ali');
    await userEvent.click(await screen.findByText('Alice Nguyen', {}, { timeout: 5000 }));

    expect(screen.getByLabelText('Filter changes by worker')).toHaveValue('Alice Nguyen');
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(`/hr/compensation/changes/worker/${workerId}`), { timeout: 5000 });
  });

  it('enables SendForApproval for a SUBMITTED change and posts to the send-for-approval command', async () => {
    const changeId = '00000000-0000-4000-8000-000000000701';
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/hr/compensation/plans') return apiResponse([]);
      if (url === '/hr/compensation/bands') return apiResponse([]);
      if (url === '/hr/compensation/bonus-cycles') return apiResponse([]);
      if (url === `/hr/compensation/changes/worker/${workerId}`) {
        return apiResponse([
          {
            id: { value: changeId },
            workerId: { value: workerId },
            changeType: 'SALARY_ADJUSTMENT',
            newAmount: 90000,
            currency: 'AED',
            effectiveDate: '2026-02-01T00:00:00.000Z',
            status: 'SUBMITTED',
          },
        ]);
      }
      if (url === `/hr/compensation/changes/${changeId}/allowed-actions`) {
        return apiResponse({ allowedActions: ['SendForApproval', 'Cancel'] });
      }
      if (url === `/hr/compensation/changes/${changeId}`) {
        return apiResponse({
          id: { value: changeId },
          workerId: { value: workerId },
          changeType: 'SALARY_ADJUSTMENT',
          newAmount: 90000,
          currency: 'AED',
          effectiveDate: '2026-02-01T00:00:00.000Z',
          status: 'SUBMITTED',
        });
      }
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
      return apiResponse({});
    });

    renderCompensation();

    expect(await screen.findByRole('heading', { name: 'Compensation' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Changes' }));
    await userEvent.type(screen.getByLabelText('Filter changes by worker'), 'ali');
    await userEvent.click(await screen.findByText('Alice Nguyen', {}, { timeout: 5000 }));

    await userEvent.click(await screen.findByText('SALARY_ADJUSTMENT'));

    const sendForApprovalButton = await screen.findByRole('button', { name: 'Send For Approval' });
    expect(sendForApprovalButton).toBeEnabled();

    await userEvent.click(sendForApprovalButton);

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/hr/compensation/changes/${changeId}/commands/send-for-approval`,
      {},
    ));
  });

  it('enables Activate for a DRAFT bonus cycle and posts to the activate command', async () => {
    const cycleId = '00000000-0000-4000-8000-000000000801';
    const cycleDetail = {
      id: { value: cycleId },
      cycleName: '2026 Annual Bonus',
      cycleYear: 2026,
      eligibilityDate: '2026-12-01T00:00:00.000Z',
      paymentDate: '2026-12-25T00:00:00.000Z',
      totalPoolAmount: 250000,
      currency: 'AED',
      status: 'DRAFT',
    };
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/hr/compensation/plans') return apiResponse([]);
      if (url === '/hr/compensation/bands') return apiResponse([]);
      if (url === '/hr/compensation/bonus-cycles') return apiResponse([cycleDetail]);
      if (url === `/hr/compensation/bonus-cycles/${cycleId}/allowed-actions`) {
        return apiResponse({ allowedActions: ['Activate'] });
      }
      if (url === `/hr/compensation/bonus-cycles/${cycleId}`) return apiResponse(cycleDetail);
      return apiResponse({});
    });

    renderCompensation();

    expect(await screen.findByRole('heading', { name: 'Compensation' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Bonus Cycles' }));
    await userEvent.click(await screen.findByText('2026 Annual Bonus'));

    const activateButton = await screen.findByRole('button', { name: 'Activate' });
    expect(activateButton).toBeEnabled();
    await userEvent.click(activateButton);

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/hr/compensation/bonus-cycles/${cycleId}/commands/activate`,
      {},
    ));
  });

  it('opens the Revise dialog prefilled with band values and posts the edited salary range', async () => {
    const bandId = '00000000-0000-4000-8000-000000000901';
    const bandDetail = {
      id: { value: bandId },
      bandCode: 'BAND-900',
      jobLevel: 'L4',
      jobFamily: 'Engineering',
      minSalary: 50000,
      midSalary: 65000,
      maxSalary: 80000,
      currency: 'AED',
      status: 'ACTIVE',
    };
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/hr/compensation/plans') return apiResponse([]);
      if (url === '/hr/compensation/bands') return apiResponse([bandDetail]);
      if (url === '/hr/compensation/bonus-cycles') return apiResponse([]);
      if (url === `/hr/compensation/bands/${bandId}/allowed-actions`) {
        return apiResponse({ allowedActions: ['Revise', 'Close'] });
      }
      if (url === `/hr/compensation/bands/${bandId}`) return apiResponse(bandDetail);
      return apiResponse({});
    });

    renderCompensation();

    expect(await screen.findByRole('heading', { name: 'Compensation' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Bands' }));
    await userEvent.click(await screen.findByText('BAND-900'));

    const reviseTrigger = await screen.findByRole('button', { name: 'Revise' });
    expect(reviseTrigger).toBeEnabled();
    await userEvent.click(reviseTrigger);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Minimum salary')).toHaveValue('50000');
    expect(within(dialog).getByLabelText('Mid salary')).toHaveValue('65000');
    expect(within(dialog).getByLabelText('Maximum salary')).toHaveValue('80000');

    await userEvent.clear(within(dialog).getByLabelText('Mid salary'));
    await userEvent.type(within(dialog).getByLabelText('Mid salary'), '70000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revise' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/hr/compensation/bands/${bandId}/commands/revise`,
      { minSalary: 50000, midSalary: 70000, maxSalary: 80000 },
    ));
  });
});
