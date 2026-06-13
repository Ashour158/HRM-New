import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeAttendanceAction, EmployeeDashboard } from './dashboard';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();
const apiClientPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: apiClientPostMock,
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      email: 'amina@example.com',
      firstName: 'Amina',
      lastName: 'Nour',
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: () => <div data-testid="area-chart" />,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const worker = {
  id: '00000000-0000-0000-0000-000000000020',
  employeeId: 'E-020',
  firstName: 'Amina',
  lastName: 'Nour',
  email: 'amina@example.com',
  hireDate: '2025-01-01',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  department: 'Design',
  jobTitle: 'Product Designer',
  manager: 'David Chen',
  legalEntity: 'Enterprise HR',
};

const todayState = {
  workerId: worker.id,
  workDate: '2026-06-09',
  status: 'OUT',
  canCheckIn: true,
  canCheckOut: false,
  firstCheckInAt: '2026-06-09T06:00:00.000Z',
  latestCheckOutAt: '2026-06-09T14:15:00.000Z',
  elapsedMinutes: 0,
  totalWorkedMinutes: 495,
  locationStatus: 'INSIDE_GEOFENCE',
  events: [],
};

const periodView = {
  periodStart: '2026-06-03',
  periodEnd: '2026-06-09',
  range: 'WEEKLY',
  scope: 'SELF',
  totals: {
    employeeDays: 5,
    present: 4,
    absent: 0,
    onLeave: 1,
    exceptions: 1,
    payableHours: 38.5,
    deductionHours: 0.5,
    overtimeHours: 2,
    geofenceViolations: 0,
    lateMinutes: 15,
    missingCheckout: 0,
    payrollReady: 4,
    undertimeMinutes: 30,
  },
  series: [
    {
      workDate: '2026-06-09',
      employeeDays: 1,
      present: 1,
      absent: 0,
      onLeave: 0,
      exceptions: 1,
      payableHours: 8.25,
      deductionHours: 0,
      overtimeHours: 0.25,
      geofenceViolations: 0,
      lateMinutes: 5,
      missingCheckout: 0,
      payrollReady: 1,
      undertimeMinutes: 0,
    },
  ],
  insights: {
    attendanceScore: 82,
    coverageRisk: 'MEDIUM',
    payrollBlockers: 1,
    policyViolations: 2,
    trend: 'WATCH',
  },
  policyEvidence: {
    eventCodes: ['LATE'],
    flexibleRuleCodes: ['FLEX-CORE-09-15'],
    leavePolicyTypes: ['ANNUAL'],
    payrollBlockRules: ['LATE'],
    scheduleSources: ['ROTATING_SHIFT_A'],
    trustMinimums: [70],
  },
};

describe('EmployeeDashboard attendance view', () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiClientPostMock.mockReset();
    useApiMutationMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-attendance-setup') return { data: DEFAULT_HCM_SETUP, isLoading: false };
      if (key === 'employee-attendance-action-setup') return { data: DEFAULT_HCM_SETUP, isLoading: false };
      if (key === 'employee-dashboard-profile') return { data: worker, isLoading: false };
      if (key === 'employee-attendance-action-profile') return { data: worker, isLoading: false };
      if (key === 'employee-attendance-state') return { data: todayState, isLoading: false };
      if (key === 'employee-attendance-period-view') return { data: periodView, isLoading: false };
      if (key === 'employee-attendance-corrections') return { data: [], isLoading: false };
      return { data: undefined, isLoading: false };
    });
  });

  it('shows the period ledger details and policy signals behind attendance', () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <EmployeeDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Attendance ledger detail')).toBeInTheDocument();
    expect(screen.getByText('Jun 9')).toBeInTheDocument();
    expect(screen.getAllByText('8h 15m').length).toBeGreaterThan(0);
    expect(screen.getByText('Policy signals')).toBeInTheDocument();
    expect(screen.getByText('FLEX-CORE-09-15')).toBeInTheDocument();
    expect(screen.getByText('ROTATING_SHIFT_A')).toBeInTheDocument();
    expect(screen.getAllByText('82%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MEDIUM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Payroll blockers').length).toBeGreaterThan(0);
    expect(screen.getByText('70+ score')).toBeInTheDocument();
  });

  it('sends a stable idempotency key when recording employee check-in', async () => {
    const checkInMutation = vi.fn(async (_payload: unknown) => ({}));
    useApiMutationMock.mockImplementation((path: string) => ({
      mutateAsync: path === '/time/attendance/check-in' ? checkInMutation : vi.fn(async () => ({})),
      isPending: false,
    }));
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) => success({
          coords: {
            accuracy: 12,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            latitude: 30.0444,
            longitude: 31.2357,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition)),
      },
    });
    window.localStorage.setItem('pending-attendance-clock', 'in');

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <EmployeeDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => expect(checkInMutation).toHaveBeenCalledTimes(1));
    const payload = checkInMutation.mock.calls[0]?.[0] as {
      captureReference?: string;
      clientRequestId?: string;
      idempotencyKey?: string;
      workerId?: string;
    };
    expect(payload.workerId).toBe(worker.id);
    expect(payload.idempotencyKey).toMatch(/^clock-in-00000000-0000-0000-0000-000000000020-/);
    expect(payload.clientRequestId).toBe(payload.idempotencyKey);
    expect(payload.captureReference).toBe(payload.idempotencyKey);
  });

  it('sends the same evidence envelope from the direct check-in route', async () => {
    apiClientPostMock.mockResolvedValue({ data: { eventId: 'evt-1' } });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) => success({
          coords: {
            accuracy: 9,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            latitude: 30.0444,
            longitude: 31.2357,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition)),
      },
    });

    render(
      <MemoryRouter
        initialEntries={['/employee/attendance/check-in?workplaceCode=CAIRO_HQ']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/employee/attendance/:direction" element={<EmployeeAttendanceAction />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledTimes(1));
    const payload = apiClientPostMock.mock.calls[0]?.[1] as {
      captureEvidence?: { geolocationCapture?: { captured?: boolean; policyRequiresGeolocation?: boolean } };
      captureMethod?: string;
      captureReference?: string;
      clientRequestId?: string;
      idempotencyKey?: string;
      verificationStatus?: string;
      workerId?: string;
    };
    expect(payload.workerId).toBe(worker.id);
    expect(payload.idempotencyKey).toMatch(/^clock-in-00000000-0000-0000-0000-000000000020-/);
    expect(payload.clientRequestId).toBe(payload.idempotencyKey);
    expect(payload.captureReference).toBe(payload.idempotencyKey);
    expect(payload.captureMethod).toBe('MOBILE_GEOFENCE');
    expect(payload.verificationStatus).toBe('VERIFIED');
    expect(payload.captureEvidence?.geolocationCapture).toMatchObject({
      captured: true,
      policyRequiresGeolocation: true,
    });
  });
});
