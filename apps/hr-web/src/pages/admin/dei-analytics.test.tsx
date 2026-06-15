import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDeiAnalytics } from './dei-analytics';

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

function renderAdminDeiAnalytics() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminDeiAnalytics />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminDeiAnalytics', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/dei-analytics/dei-reports/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: 'dei-1',
            reportType: 'WORKFORCE_DIVERSITY',
            reportingPeriod: '2026-Q2',
            countryCode: 'AE',
            metrics: {
              genderDistribution: { female: 56, male: 44 },
              locationDistribution: { Dubai: 62, Cairo: 38 },
              leadershipRepresentation: { female: 41, male: 59 },
            },
            suppressionApplied: true,
            status: 'PUBLISHED',
          },
        ]);
      }
      if (url === `/dei-analytics/pay-gap-reports/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: 'gap-1',
            reportType: 'GENDER_PAY_GAP',
            reportingYear: 2026,
            countryCode: 'AE',
            meanHourlyGap: 7.4,
            medianHourlyGap: 5.9,
            quartileDistribution: { lower: 45, lowerMiddle: 51, upperMiddle: 48, upper: 42 },
            status: 'CALCULATED',
          },
        ]);
      }
      if (url === `/dei-analytics/pay-equity-reviews/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: 'equity-1',
            reviewName: 'Q2 Pay Equity Review',
            reviewPeriod: '2026-Q2',
            findings: { unexplainedGapPercent: 2.2, impactedEmployees: 14 },
            remediationActions: { salaryAdjustments: 8 },
            status: 'FINDINGS',
          },
        ]);
      }
      if (url === `/dei-analytics/attrition-segment-reports/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: 'attrition-1',
            reportPeriod: '2026-Q2',
            segmentType: 'DEPARTMENT',
            segments: { Engineering: 4, Nursing: 9, Operations: 6 },
            status: 'GENERATED',
          },
        ]);
      }
      return apiResponse([]);
    });
  });

  it('renders a DEI analytics dashboard from tenant-scoped reports', async () => {
    renderAdminDeiAnalytics();

    expect(await screen.findByRole('heading', { name: 'DEI Analytics' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(`/dei-analytics/dei-reports/tenant/${tenantId}`));
    expect(screen.getByText('Gender distribution')).toBeInTheDocument();
    expect(screen.getByText('Pay gap')).toBeInTheDocument();
    expect(screen.getByText('Q2 Pay Equity Review')).toBeInTheDocument();
    expect(screen.getByText('Attrition segments')).toBeInTheDocument();
    expect(screen.getByText('Suppression applied')).toBeInTheDocument();
  });
});
