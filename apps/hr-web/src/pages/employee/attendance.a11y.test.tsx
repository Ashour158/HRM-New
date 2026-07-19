import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
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
  ],
  policyEvidence: {
    flexibleRuleCodes: ['FLEX-CORE-09-15'],
    leavePolicyTypes: ['ANNUAL'],
    scheduleSources: ['ROTATING_SHIFT_A'],
  },
};

describe('EmployeeAttendance accessibility', () => {
  it('renders without accessibility violations', async () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
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

    const { container } = render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <EmployeeAttendance />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'My Attendance' })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
