import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApprovalsConfig } from './approvals-config';

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

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderApprovalsConfig() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminApprovalsConfig />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminApprovalsConfig', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
  });

  it('adds a routing condition to an existing approval path and saves it with the payload', async () => {
    const user = userEvent.setup();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/platform/workflow/approval-config') {
        return apiResponse({
          tenantId: '00000000-0000-4000-8000-000000000001',
          rules: [{
            code: 'COMP_CHANGE_APPROVAL',
            label: 'Compensation change approval',
            active: true,
            commandName: 'ApproveCompensationChange',
            aggregateType: 'CompensationChange',
            slaHours: 24,
            steps: [
              { code: 'HR_REVIEW', label: 'HR review', active: true, order: 1, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'HR_ADMIN', slaHours: 24 },
            ],
          }],
        });
      }
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { tenantId: '00000000-0000-4000-8000-000000000001', rules: [] } } });

    renderApprovalsConfig();

    // "Compensation change approval" also appears as a static template label, so wait on
    // "Routing conditions" instead — it only renders once the loaded rule card is present.
    expect(await screen.findByText('Routing conditions')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add condition/i }));

    await user.type(screen.getByLabelText('Payload field'), 'newAnnualSalary');
    await user.selectOptions(screen.getByLabelText('Operator'), 'GREATER_THAN');
    await user.type(screen.getByLabelText('Value'), '10000');

    await user.click(screen.getByRole('button', { name: 'Save Approval Paths' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/platform/workflow/approval-config',
      expect.objectContaining({
        rules: expect.arrayContaining([
          expect.objectContaining({
            code: 'COMP_CHANGE_APPROVAL',
            conditions: [{ field: 'newAnnualSalary', operator: 'GREATER_THAN', value: '10000' }],
          }),
        ]),
      }),
    ));
  });

  it('removes a routing condition from an approval path', async () => {
    const user = userEvent.setup();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/platform/workflow/approval-config') {
        return apiResponse({
          tenantId: '00000000-0000-4000-8000-000000000001',
          rules: [{
            code: 'LONG_LEAVE_APPROVAL',
            label: 'Long leave approval',
            active: true,
            commandName: 'ApproveAbsenceRequest',
            aggregateType: 'AbsenceRequest',
            slaHours: 16,
            conditions: [{ field: 'durationDays', operator: 'GREATER_THAN', value: 5 }],
            steps: [
              { code: 'MANAGER_REVIEW', label: 'Manager review', active: true, order: 1, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'MANAGER', slaHours: 16 },
            ],
          }],
        });
      }
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { tenantId: '00000000-0000-4000-8000-000000000001', rules: [] } } });

    renderApprovalsConfig();

    expect(await screen.findByDisplayValue('durationDays')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove condition' }));

    await user.click(screen.getByRole('button', { name: 'Save Approval Paths' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/platform/workflow/approval-config',
      expect.objectContaining({
        rules: expect.arrayContaining([
          expect.objectContaining({ code: 'LONG_LEAVE_APPROVAL', conditions: [] }),
        ]),
      }),
    ));
  });
});
