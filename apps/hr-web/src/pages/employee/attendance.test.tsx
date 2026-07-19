import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeAttendance } from './attendance';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';

const useApiQueryMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
}));

const worker = {
  id: '00000000-0000-0000-0000-000000000030',
  employeeId: 'E-030',
  firstName: 'Lina',
  lastName: 'Farouk',
  email: 'lina@example.com',
  hireDate: '2025-02-01',
  status: 'ACTIVE',
};

const todayState = {
  workerId: worker.id,
  workDate: '2026-07-13',
  status: 'OUT',
  canCheckIn: true,
  canCheckOut: false,
  firstCheckInAt: '2026-07-13T06:00:00.000Z',
  latestCheckOutAt: '2026-07-13T14:15:00.000Z',
  elapsedMinutes: 0,
  totalWorkedMinutes: 495,
  locationStatus: 'INSIDE_GEOFENCE',
  events: [
    {
      id: 'evt-1',
      eventType: 'CLOCK_IN',
      timestamp: '2026-07-13T06:00:00.000Z',
      deviceId: 'browser',
      locationStatus: 'INSIDE_GEOFENCE',
    },
  ],
};

const periodView = {
  periodStart: '2026-07-07',
  periodEnd: '2026-07-13',
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
      workDate: '2026-07-13',
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
    {
      workDate: '2026-07-12',
      employeeDays: 1,
      present: 0,
      absent: 0,
      onLeave: 1,
      exceptions: 0,
      payableHours: 0,
      deductionHours: 0,
      overtimeHours: 0,
      geofenceViolations: 0,
      lateMinutes: 0,
      missingCheckout: 0,
      payrollReady: 0,
      undertimeMinutes: 0,
    },
  ],
  policyEvidence: {
    flexibleRuleCodes: ['FLEX-CORE-09-15'],
    leavePolicyTypes: ['ANNUAL'],
    scheduleSources: ['ROTATING_SHIFT_A'],
  },
};

function setupQueries(overrides: Record<string, unknown> = {}) {
  useApiQueryMock.mockImplementation((queryKey: unknown) => {
    const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
    if (key in overrides) return overrides[key];
    if (key === 'employee-attendance-page-setup') return { data: DEFAULT_HCM_SETUP, isLoading: false };
    if (key === 'employee-attendance-page-profile') return { data: worker, isLoading: false };
    if (key === 'employee-attendance-page-today-state') return { data: todayState, isLoading: false };
    if (key === 'employee-attendance-page-period-view') {
      return { data: periodView, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    }
    if (key === 'employee-attendance-page-corrections') return { data: [], isLoading: false };
    if (key === 'employee-attendance-page-work-schedules') return { data: [], isLoading: false };
    return { data: undefined, isLoading: false };
  });
}

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <EmployeeAttendance />
    </MemoryRouter>,
  );
}

describe('EmployeeAttendance', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
  });

  it('shows the hours-worked summary, check-in history, and shift schedule fallback', () => {
    setupQueries();
    renderPage();

    expect(screen.getByRole('heading', { name: 'My Attendance' })).toBeInTheDocument();

    // KPI tiles built from the period-view SELF totals.
    expect(screen.getByText('38.5h')).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
    expect(screen.getByText('15 min')).toBeInTheDocument();

    // Check-in / check-out history rows, most recent first.
    expect(screen.getByText('Check-in / check-out history')).toBeInTheDocument();
    expect(screen.getByText('On leave')).toBeInTheDocument();
    expect(screen.getAllByText(/Present|Exception flagged/).length).toBeGreaterThan(0);

    // No active work-schedule override -> falls back to the tenant policy grid.
    expect(screen.getByText('No custom shift override is assigned. Showing the tenant default policy schedule.')).toBeInTheDocument();
    expect(screen.getByText('Daily shift')).toBeInTheDocument();

    // Today's live status and check-in/out actions link to the existing action route.
    expect(screen.getAllByText('Checked out').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /check in/i })).toHaveAttribute('href', '/employee/attendance/in');
    expect(screen.getByRole('link', { name: /check out/i })).toHaveAttribute('href', '/employee/attendance/out');
  });

  it('renders an active work schedule instead of the policy fallback when one exists', () => {
    setupQueries({
      'employee-attendance-page-work-schedules': {
        data: [
          {
            scheduleType: 'ROTATING_SHIFT',
            startDate: '2026-06-01',
            daysOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
            hoursPerDay: 8,
            timezone: 'Africa/Cairo',
            status: 'ACTIVE',
          },
        ],
        isLoading: false,
      },
    });
    renderPage();

    expect(screen.getByText('ROTATING SHIFT')).toBeInTheDocument();
    expect(screen.getByText(/MON, TUE, WED, THU, FRI - 8h\/day/)).toBeInTheDocument();
    expect(screen.queryByText('No custom shift override is assigned. Showing the tenant default policy schedule.')).not.toBeInTheDocument();
  });

  it('shows an empty state when there is no attendance activity in the selected period', () => {
    setupQueries({
      'employee-attendance-page-period-view': {
        data: { ...periodView, series: [] },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      },
    });
    renderPage();

    expect(screen.getByText('No attendance activity in this period')).toBeInTheDocument();
  });
});
