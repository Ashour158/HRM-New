import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLeaveManagement } from './leave-management';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const apiClientPatchMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
    patch: apiClientPatchMock,
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

const annualLeavePolicy = {
  code: 'ANNUAL',
  label: 'Annual leave',
  active: true,
  unit: 'DAYS',
  paid: true,
  deductFromBalance: true,
  requestableByEmployee: true,
  payrollImpact: 'PAID_LEAVE',
  approvalWorkflow: 'MANAGER',
  annualEntitlement: 21,
};

const sickLeavePolicyInactive = {
  code: 'SICK_LEGACY',
  label: 'Legacy sick leave',
  active: false,
  unit: 'DAYS',
  paid: true,
  deductFromBalance: true,
  requestableByEmployee: false,
  payrollImpact: 'PAID_LEAVE',
  approvalWorkflow: 'MANAGER',
};

function renderLeaveManagement() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminLeaveManagement />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminLeaveManagement leave policy editor', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    apiClientPatchMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/hr/core/workers?pageSize=250') return apiResponse([]);
      if (url === '/manager/leave/requests') return apiResponse([]);
      if (url === '/employee/absences/policies') {
        return apiResponse({ policies: [annualLeavePolicy], publicHolidays: [], standardDailyMinutes: 480, workDays: [0, 1, 2, 3, 4] });
      }
      if (url === '/admin/hcm-setup') {
        return apiResponse({ leavePolicies: [annualLeavePolicy, sickLeavePolicyInactive] });
      }
      return apiResponse({});
    });
    apiClientPatchMock.mockImplementation((_url: string, body: { leavePolicies: unknown[] }) => apiResponse({ leavePolicies: body.leavePolicies }));
  });

  it('shows the full policy editor, including inactive policies not requestable by employees', async () => {
    renderLeaveManagement();

    await userEvent.click(await screen.findByRole('tab', { name: 'Policies' }));

    expect(await screen.findByText('Leave Policy Editor')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ANNUAL')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SICK_LEGACY')).toBeInTheDocument();
  });

  it('edits and saves a leave policy through /admin/hcm-setup', async () => {
    renderLeaveManagement();

    await userEvent.click(await screen.findByRole('tab', { name: 'Policies' }));
    await screen.findByDisplayValue('ANNUAL');

    const entitlementInput = screen.getByDisplayValue('21');
    await userEvent.clear(entitlementInput);
    await userEvent.type(entitlementInput, '25');

    await userEvent.click(screen.getByRole('button', { name: 'Save Leave Policies' }));

    await waitFor(() => expect(apiClientPatchMock).toHaveBeenCalledWith(
      '/admin/hcm-setup',
      expect.objectContaining({
        leavePolicies: expect.arrayContaining([
          expect.objectContaining({ code: 'ANNUAL', annualEntitlement: 25 }),
        ]),
      }),
    ));
  });

  it('adds a new draft policy row and removes it', async () => {
    renderLeaveManagement();

    await userEvent.click(await screen.findByRole('tab', { name: 'Policies' }));
    await screen.findByDisplayValue('ANNUAL');

    const editorCard = screen.getByText('Leave Policy Editor').closest('[class*="rounded"]') as HTMLElement;
    await userEvent.click(within(editorCard).getByRole('button', { name: 'Add' }));

    const removeButtons = screen.getAllByRole('button', { name: /^Remove / });
    expect(removeButtons.length).toBe(3);

    await userEvent.click(removeButtons[removeButtons.length - 1]);
    expect(screen.getAllByRole('button', { name: /^Remove / }).length).toBe(2);
  });
});
