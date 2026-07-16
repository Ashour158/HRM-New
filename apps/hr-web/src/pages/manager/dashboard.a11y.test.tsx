import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerDashboard } from './dashboard';

const useApiQueryMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      email: 'manager@example.com',
      firstName: 'Mariam',
      lastName: 'Hassan',
    },
  }),
}));

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: () => <div data-testid="area-chart" />,
  Bar: () => null,
  BarChart: () => <div data-testid="bar-chart" />,
  CartesianGrid: () => null,
  Cell: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: () => <div data-testid="line-chart" />,
  Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const managerProfile = {
  id: '00000000-0000-0000-0000-000000000010',
  employeeId: 'M-010',
  firstName: 'Mariam',
  lastName: 'Hassan',
  email: 'manager@example.com',
  hireDate: '2024-01-01',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  department: 'Operations',
  jobTitle: 'Operations Manager',
};

const directReport = {
  id: '00000000-0000-0000-0000-000000000020',
  employeeId: 'E-020',
  firstName: 'Mina',
  lastName: 'Soliman',
  email: 'mina@example.com',
  hireDate: '2025-01-01',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  department: 'Operations',
  jobTitle: 'Coordinator',
};

const dashboardData = {
  directReports: [directReport],
  pendingApprovals: {
    absences: [],
    expenses: 1,
    timesheets: 1,
  },
  teamMetrics: {
    averagePerformance: 88,
    headcount: 1,
    openGoals: 2,
  },
};

const attendanceTotals = {
  absent: 0,
  deductionHours: 0,
  employeeDays: 1,
  exceptions: 1,
  geofenceViolations: 0,
  lateMinutes: 10,
  missingCheckout: 0,
  onLeave: 0,
  overtimeHours: 0,
  payableHours: 8,
  payrollReady: 1,
  present: 1,
  undertimeMinutes: 0,
};

const periodView = {
  periodStart: '2026-07-09',
  periodEnd: '2026-07-13',
  range: 'WEEKLY',
  scope: 'TEAM',
  totals: attendanceTotals,
  series: [{ ...attendanceTotals, workDate: '2026-07-13' }],
  workers: [
    {
      ...attendanceTotals,
      workerId: directReport.id,
      employeeId: directReport.employeeId,
      name: 'Mina Soliman',
      departmentName: 'Operations',
      managerId: managerProfile.id,
    },
  ],
};

describe('ManagerDashboard accessibility', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'manager-dashboard') return { data: dashboardData, isLoading: false, isError: false, error: null, refetch: vi.fn() };
      if (key === 'manager-dashboard-self-profile') return { data: managerProfile, isLoading: false };
      if (key === 'manager-own-attendance-period-view') return { data: { ...periodView, scope: 'SELF', workers: [] }, isLoading: false };
      if (key === 'manager-team-attendance-period-view') return { data: periodView, isLoading: false };
      return { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    });
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <ManagerDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Mariam/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText('My Attendance')).toBeInTheDocument();
    expect(screen.getAllByText('Team Attendance').length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: 'Attendance period' })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
