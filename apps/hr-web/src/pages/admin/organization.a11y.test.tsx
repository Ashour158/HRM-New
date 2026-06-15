import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminOrganization } from './organization';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminOrganization position control accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/hr/organization/summary') return apiResponse({ legalEntities: [], orgUnits: [], orgChart: [], managerRelationships: [] });
      if (url === '/hr/organization/legal-entities') return apiResponse([]);
      if (url === '/hr/organization/org-units') return apiResponse([]);
      if (url === '/hr/organization/org-units/tree') return apiResponse([]);
      if (url === '/hr/core/workers?pageSize=250') return apiResponse([]);
      if (url === '/hr/organization/workforce-planning') {
        return apiResponse({
          summary: { activeHeadcount: 0, vacancies: 0, pendingHeadcount: 0 },
          orgChart: { byDepartment: [], byLegalEntity: [], byManager: [] },
          headcountPlan: [],
          workforceCostPlan: { totalAnnualCost: 0 },
          skillsGap: [],
          strategicDashboard: { vacancyRiskPercent: 0, retirementRisk: 0, successionGaps: 0, criticalRolesWithoutBackup: 0, attritionHotspots: [] },
          aiForecast: [],
        });
      }
      if (url.startsWith('/hr/organization/org-chart')) return apiResponse({ groupBy: 'department', filters: [], nodes: [] });
      if (url === '/hr/position-control/positions') return apiResponse([]);
      if (url === '/hr/position-control/positions/vacant') return apiResponse([]);
      if (url === '/hr/position-control/headcount-requests') return apiResponse([]);
      return apiResponse({});
    });
  });

  it('renders the position control tabs without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminOrganization initialTab="positions" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Organization Admin' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Positions' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/hr/position-control/positions'));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
