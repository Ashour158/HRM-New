import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminInsights } from './insights';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const tenantId = '00000000-0000-4000-8000-000000000001';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
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

function renderInsights() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminInsights />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminInsights', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/intelligence/attrition-risk/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: 'risk-1',
            workerId: '00000000-0000-0000-0000-000000000012',
            periodKey: '2026-06',
            score: 0.72,
            band: 'HIGH',
            factors: [{ factor: 'Engagement trend', weight: 0.8, detail: 'Engagement dropped.' }],
            modelVersion: '2026.06.01',
            createdAt: '2026-06-15T08:00:00.000Z',
          },
        ]);
      }
      if (url === `/intelligence/anomalies/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: 'anom-1',
            workerId: '00000000-0000-0000-0000-000000000012',
            periodKey: '2026-06',
            anomalyType: 'ATTENDANCE_PAYROLL',
            score: 0.9,
            band: 'HIGH',
            factors: [{ factor: 'Pay delta', weight: 1, detail: 'Net pay changed by 25%.' }],
            createdAt: '2026-06-15T08:01:00.000Z',
          },
        ]);
      }
      return apiResponse([]);
    });
  });

  it('renders explainable workforce intelligence signals', async () => {
    renderInsights();

    expect(await screen.findByRole('heading', { name: 'Workforce Insights' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(`/intelligence/attrition-risk/tenant/${tenantId}`));
    expect(screen.getByText('Attrition risk bands')).toBeInTheDocument();
    expect(screen.getByText('Attendance and payroll anomalies')).toBeInTheDocument();
    expect(screen.getByText('Engagement dropped.')).toBeInTheDocument();
    expect(screen.getByText('Net pay changed by 25%.')).toBeInTheDocument();
  });
});
