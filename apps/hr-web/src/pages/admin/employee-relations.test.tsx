import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEmployeeRelations } from './employee-relations';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000099';
const workerId = '00000000-0000-4000-8000-000000000501';
const caseId = '00000000-0000-4000-8000-000000000101';
const investigationId = '00000000-0000-4000-8000-000000000201';
const disciplinaryId = '00000000-0000-4000-8000-000000000301';

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

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: actorId,
      roles: [{ id: 'role-1', name: 'ER_SPECIALIST' }],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderEmployeeRelations() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminEmployeeRelations />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminEmployeeRelations', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/employee-relations/cases/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: { value: caseId },
            caseNumber: 'ER-2026-0001',
            subjectWorkerId: workerId,
            caseType: 'GRIEVANCE',
            severity: 'HIGH',
            description: 'Confidential employee relations concern',
            assignedTo: actorId,
            status: 'OPEN',
          },
        ]);
      }
      if (url === `/employee-relations/investigations/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: { value: investigationId },
            erCaseId: caseId,
            leadInvestigatorId: actorId,
            findings: 'Sensitive evidence notes',
            status: 'DRAFT',
          },
        ]);
      }
      if (url === `/employee-relations/disciplinary-actions/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: { value: disciplinaryId },
            workerId,
            erCaseId: caseId,
            actionType: 'WRITTEN_WARNING',
            severity: 'HIGH',
            description: 'Confidential action details',
            status: 'DRAFT',
          },
        ]);
      }
      if (url === `/employee-relations/accommodation-cases/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: { value: '00000000-0000-4000-8000-000000000401' },
            workerId,
            requestType: 'WORKSTATION_ADJUSTMENT',
            medicalDocumentation: 'medical-doc-ref-001',
            status: 'REQUESTED',
          },
        ]);
      }
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { allowedNextActions: [] } } });
  });

  it('renders confidential ER tabs and creates a tenant-scoped case', async () => {
    renderEmployeeRelations();

    expect(await screen.findByRole('heading', { name: 'Employee Relations' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Cases' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Investigations' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Disciplinary' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Accommodations' })).toBeInTheDocument();
    expect(await screen.findByText('ER-2026-0001')).toBeInTheDocument();
    expect(screen.getAllByText(/Co\*\*\*\*rn/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Open Case' }));
    await userEvent.clear(screen.getByLabelText('Case number'));
    await userEvent.type(screen.getByLabelText('Case number'), 'ER-2026-0002');
    await userEvent.clear(screen.getByLabelText('Subject worker ID'));
    await userEvent.type(screen.getByLabelText('Subject worker ID'), workerId);
    await userEvent.click(screen.getByRole('button', { name: 'Save Case' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/employee-relations/cases',
      expect.objectContaining({
        caseNumber: 'ER-2026-0002',
        subjectWorkerId: workerId,
        openedBy: actorId,
      }),
    ));
  });

  it('runs ER case, investigation, disciplinary, and accommodation commands', async () => {
    renderEmployeeRelations();

    expect(await screen.findByText('ER-2026-0001')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review ER-2026-0001' }));
    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/employee-relations/cases/${caseId}/commands/review`,
      {},
    ));

    await userEvent.click(screen.getByRole('tab', { name: 'Investigations' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start investigation' }));
    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/employee-relations/investigations/${investigationId}/commands/start`,
      {},
    ));

    await userEvent.click(screen.getByRole('tab', { name: 'Disciplinary' }));
    await userEvent.click(screen.getByRole('button', { name: 'Approve disciplinary action' }));
    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/employee-relations/disciplinary-actions/${disciplinaryId}/commands/approve`,
      { approvedBy: actorId },
    ));

    await userEvent.click(screen.getByRole('tab', { name: 'Accommodations' }));
    expect(await screen.findByText('WORKSTATION_ADJUSTMENT')).toBeInTheDocument();
    expect(screen.getByText(/me\*\*\*\*01/)).toBeInTheDocument();
  });
});
