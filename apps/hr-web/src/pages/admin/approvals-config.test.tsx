import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApprovalsConfig } from './approvals-config';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-4000-8000-000000000001';

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
    tenantConfig: { currency: 'AED', dateFormat: 'DD/MM/YYYY', timezone: 'Asia/Dubai', features: [] },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

const compensationRule = {
  code: 'COMP_CHANGE_APPROVAL',
  label: 'Compensation change approval',
  active: true,
  commandName: 'ApproveCompensationChange',
  aggregateType: 'CompensationChange',
  slaHours: 24,
  steps: [
    { code: 'HR_REVIEW', label: 'HR review', active: true, order: 1, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'HR_ADMIN', slaHours: 24 },
  ],
};

const leaveRule = {
  code: 'LONG_LEAVE_APPROVAL',
  label: 'Long leave approval',
  active: true,
  commandName: 'ApproveAbsenceRequest',
  aggregateType: 'AbsenceRequest',
  slaHours: 16,
  steps: [
    { code: 'MANAGER_REVIEW', label: 'Manager review', active: true, order: 1, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'MANAGER', slaHours: 16 },
  ],
};

function renderApprovalsConfig(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AdminApprovalsConfig />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminApprovalsConfig command query-param filtering', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/platform/workflow/approval-config') {
        return apiResponse({ tenantId, rules: [compensationRule, leaveRule] });
      }
      return apiResponse({});
    });
  });

  it('shows every approval path when no command query param is present', async () => {
    renderApprovalsConfig('/admin/system-console/approvals');

    expect(await screen.findByDisplayValue('ApproveCompensationChange')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ApproveAbsenceRequest')).toBeInTheDocument();
  });

  it('pre-filters approval paths matching the command keyword and can clear the filter', async () => {
    renderApprovalsConfig('/admin/system-console/approvals?command=Compensation');

    expect(await screen.findByDisplayValue('ApproveCompensationChange')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('ApproveAbsenceRequest')).not.toBeInTheDocument();
    expect(screen.getByText('Filtered to paths matching "Compensation"')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Clear filter/ }));

    await waitFor(() => expect(screen.getByDisplayValue('ApproveAbsenceRequest')).toBeInTheDocument());
  });

  it('offers to create a new approval path scoped to the command when no rule matches', async () => {
    renderApprovalsConfig('/admin/system-console/approvals?command=Onboarding');

    expect(await screen.findByText('No approval paths match "Onboarding"')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add path for "Onboarding"' }));

    expect(await screen.findByDisplayValue('Onboarding')).toBeInTheDocument();
  });
});
