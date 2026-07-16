import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AdminGetStarted } from './get-started';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const tenantId = '00000000-0000-4000-8000-000000000001';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: vi.fn(),
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

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminGetStarted accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/admin/system-console/readiness') return apiResponse({ overallScore: 62, domains: [] });
      if (url === '/admin/hcm-setup') {
        return apiResponse({
          departments: [{ code: 'ENG', label: 'Engineering', active: true }],
          locations: [{ code: 'HQ', label: 'HQ', active: true }],
          statutoryPayrollPacks: [{ code: 'US', label: 'US Payroll', active: true }],
        });
      }
      if (url === '/hr/organization/summary') {
        return apiResponse({ legalEntities: [{ id: '1' }], orgUnits: [{ id: '1' }], managerRelationships: [] });
      }
      if (url === '/hr/core/workers?pageSize=1') return apiResponse([{ id: '00000000-0000-4000-8000-000000000901' }]);
      if (url === '/admin/policies/summary') return apiResponse({ leavePolicies: 1, payrollPacks: 1, earningPolicies: 0, deductionPolicies: 0 });
      if (url === '/hr/integrations/readiness') return apiResponse({ adapters: [] });
      if (url.startsWith('/auth/providers')) return apiResponse([]);
      return apiResponse([]);
    });
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <MemoryRouter>
            <AdminGetStarted />
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Get started' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(`/auth/providers?tenantId=${encodeURIComponent(tenantId)}`));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
