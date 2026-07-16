import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminReadiness } from './readiness';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
  },
}));

const snapshot = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  generatedAt: '2026-06-10T09:00:00.000Z',
  overallStatus: 'WARNING',
  overallScore: 78,
  productionReady: false,
  summary: { READY: 4, WARNING: 2, BLOCKED: 1, NOT_CONFIGURED: 1 },
  domains: [
    {
      code: 'PAYROLL',
      label: 'Payroll',
      status: 'BLOCKED',
      summary: 'Payroll close controls need review.',
      blockers: ['Statutory pack missing for EG'],
      warnings: [],
      evidence: ['Last close run 2026-06-01'],
      metrics: { runsThisYear: 6 },
      actionPath: '/admin/system-console/payroll',
    },
    {
      code: 'POLICIES',
      label: 'Policies',
      status: 'WARNING',
      summary: 'Some policy revisions are pending approval.',
      blockers: [],
      warnings: ['3 revisions awaiting approval'],
      evidence: ['Policy center active'],
      metrics: { pending: 3 },
      actionPath: '/admin/system-console/policies',
    },
  ],
  criticalBlockers: ['Statutory pack missing for EG'],
  warnings: ['3 revisions awaiting approval'],
};

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminReadiness accessibility', () => {
  it('renders without accessibility violations', async () => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation(() => apiResponse(snapshot));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminReadiness />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Production Readiness' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/admin/system-console/readiness'));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
