import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminOrganization } from './organization';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const apiClientPatchMock = vi.hoisted(() => vi.fn());

const positionId = '00000000-0000-4000-8000-000000000901';
const headcountRequestId = '00000000-0000-4000-8000-000000000902';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    patch: apiClientPatchMock,
    post: apiClientPostMock,
  },
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderOrganization(initialTab = 'positions') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminOrganization initialTab={initialTab} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminOrganization position control', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    apiClientPatchMock.mockReset();

    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/hr/organization/summary') {
        return apiResponse({ legalEntities: [], orgUnits: [], orgChart: [], managerRelationships: [] });
      }
      if (url === '/hr/organization/legal-entities') return apiResponse([]);
      if (url === '/hr/organization/org-units') return apiResponse([]);
      if (url === '/hr/organization/org-units/tree') return apiResponse([]);
      if (url === '/hr/core/workers?pageSize=250') return apiResponse([]);
      if (url === '/hr/organization/workforce-planning') {
        return apiResponse({
          summary: { activeHeadcount: 0, vacancies: 1, pendingHeadcount: 2 },
          orgChart: { byDepartment: [], byLegalEntity: [], byManager: [] },
          headcountPlan: [],
          workforceCostPlan: { totalAnnualCost: 0 },
          skillsGap: [],
          strategicDashboard: { vacancyRiskPercent: 0, retirementRisk: 0, successionGaps: 0, criticalRolesWithoutBackup: 0, attritionHotspots: [] },
          aiForecast: [],
        });
      }
      if (url.startsWith('/hr/organization/org-chart')) return apiResponse({ groupBy: 'department', filters: [], nodes: [] });
      if (url === '/hr/position-control/positions') {
        return apiResponse([
          {
            id: positionId,
            positionCode: 'NURSE-001',
            title: 'Senior Nurse',
            departmentId: '00000000-0000-4000-8000-000000000111',
            employmentType: 'FULL_TIME',
            status: 'DRAFT',
          },
        ]);
      }
      if (url === '/hr/position-control/positions/vacant') {
        return apiResponse([{ id: positionId, positionCode: 'NURSE-001', title: 'Senior Nurse', status: 'VACANT' }]);
      }
      if (url === '/hr/position-control/headcount-requests') {
        return apiResponse([
          {
            id: headcountRequestId,
            requestNumber: 'HC-2026-0001',
            requestedBy: '00000000-0000-4000-8000-000000000010',
            positionsRequested: 3,
            positionsApproved: 2,
            status: 'APPROVED',
          },
        ]);
      }
      if (url === `/hr/position-control/positions/${positionId}/allowed-actions`) {
        return apiResponse({ positionId, currentState: 'DRAFT', allowedActions: ['Activate'] });
      }
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: {} } });
  });

  it('loads position control tabs from the existing organization shell', async () => {
    renderOrganization();

    expect(await screen.findByRole('heading', { name: 'Organization Admin' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Positions' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Vacancies' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Headcount' })).toBeInTheDocument();
    expect(await screen.findByText('Senior Nurse')).toBeInTheDocument();

    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/hr/position-control/positions'));
    expect(apiClientGetMock).toHaveBeenCalledWith('/hr/position-control/positions/vacant');
    expect(apiClientGetMock).toHaveBeenCalledWith('/hr/position-control/headcount-requests');
  });

  it('surfaces headcount saga output and runs position lifecycle actions', async () => {
    renderOrganization('headcount');

    expect(await screen.findByText('Headcount automation')).toBeInTheDocument();
    expect(await screen.findAllByText('HC-2026-0001')).toHaveLength(2);
    expect(await screen.findAllByText('2 positions auto-created when approved')).toHaveLength(2);

    await userEvent.click(screen.getByRole('tab', { name: 'Positions' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/hr/position-control/positions/${positionId}/commands/activate`,
      {},
    ));
  });
});
