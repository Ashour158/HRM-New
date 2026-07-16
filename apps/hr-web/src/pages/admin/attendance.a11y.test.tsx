import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAttendance } from './attendance';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenantId: '00000000-0000-4000-8000-000000000001',
    tenantName: 'Acme Health',
    tenantConfig: { currency: 'AED', dateFormat: 'DD/MM/YYYY', timezone: 'Asia/Dubai', features: [] },
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: '00000000-0000-4000-8000-000000000099', roles: [{ id: 'role-1', name: 'HR_ADMIN' }] },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

const ledgerSummary = {
  workDate: '2026-07-13',
  rows: [],
  summary: {
    absent: 0,
    exceptions: 0,
    geofenceViolations: 0,
    inProgress: 0,
    late: 0,
    missingCheckout: 0,
    onLeave: 0,
    payrollReady: 0,
    present: 0,
    totalEmployees: 0,
    undertime: 0,
  },
  exceptionQueue: [],
};

const schedulingCommandCenter = {
  workDate: '2026-07-13',
  status: 'OK',
  summary: {
    scheduledEmployees: 0,
    presentEmployees: 0,
    openShiftCount: 0,
    activeCoverageGaps: 0,
    overtimeMinutes: 0,
    fatigueRiskCount: 0,
    optimizationSuggestionCount: 0,
  },
  captureChannels: [],
  schedulePatterns: [],
  coverage: [],
  roster: { assignedShifts: [], openShifts: [], coverageGaps: [] },
  overtime: { policyThresholdMinutes: 0, pendingApprovals: 0, dailyDetectedMinutes: 0, controls: [] },
  lateEarly: { lateEmployees: 0, earlyDepartureProxyEmployees: 0, graceMinutes: 0, deductionPolicies: [] },
  fatigueRisks: [],
  optimizationSuggestions: [],
};

const periodCloseReadiness = {
  periodStart: '2026-07-01',
  periodEnd: '2026-07-31',
  year: 2026,
  month: 7,
  readiness: {
    canClose: false,
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    totalEmployees: 0,
    totalDays: 0,
    totalExpectedRows: 0,
    lockedRows: 0,
    readyRows: 0,
    blockingIssueCount: 0,
    warningIssueCount: 0,
    issues: [],
  },
};

const reportSummary = {
  periodStart: '2026-07-01',
  periodEnd: '2026-07-31',
  totals: {
    employeeDays: 0,
    present: 0,
    absent: 0,
    onLeave: 0,
    exceptions: 0,
    payableHours: 0,
    deductionHours: 0,
    overtimeHours: 0,
  },
  departments: [],
};

describe('AdminAttendance accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url.startsWith('/time/attendance/daily-ledger')) return apiResponse(ledgerSummary);
      if (url === '/admin/hcm-setup') return apiResponse({ locations: [] });
      if (url.startsWith('/time/attendance/scheduling-command-center')) return apiResponse(schedulingCommandCenter);
      if (url.startsWith('/time/attendance/period-close/readiness')) return apiResponse(periodCloseReadiness);
      if (url.startsWith('/time/attendance/reports/summary')) return apiResponse(reportSummary);
      if (url.startsWith('/time/attendance/reminders')) return apiResponse({ workDate: '2026-07-13', reminders: [] });
      if (url.startsWith('/time/attendance/correction-requests')) return apiResponse([]);
      return apiResponse([]);
    });
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminAttendance />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Attendance Control' })).toBeInTheDocument();
    await waitFor(() => {
      const calledUrls = apiClientGetMock.mock.calls.map((call) => call[0]);
      expect(calledUrls).toEqual(expect.arrayContaining([
        '/admin/hcm-setup',
        expect.stringContaining('/time/attendance/scheduling-command-center'),
        expect.stringContaining('/time/attendance/period-close/readiness'),
        expect.stringContaining('/time/attendance/reports/summary'),
        expect.stringContaining('/time/attendance/reminders'),
        expect.stringContaining('/time/attendance/correction-requests'),
      ]));
    });
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
