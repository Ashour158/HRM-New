import { render, screen } from '@testing-library/react';
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
  CartesianGrid: () => null,
  Cell: () => null,
  Legend: () => null,
  Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
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
    expenses: 0,
    timesheets: 0,
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
  periodStart: '2026-06-09',
  periodEnd: '2026-06-09',
  range: 'DAILY',
  scope: 'TEAM',
  totals: attendanceTotals,
  series: [{ ...attendanceTotals, workDate: '2026-06-09' }],
  insights: {
    attendanceScore: 88,
    coverageRisk: 'MEDIUM',
    payrollBlockers: 0,
    policyViolations: 2,
    trend: 'STABLE',
  },
  workers: [
    {
      ...attendanceTotals,
      attendanceScore: 88,
      workerId: directReport.id,
      employeeId: directReport.employeeId,
      name: 'Mina Soliman',
      departmentName: 'Operations',
      managerId: managerProfile.id,
      payrollBlockers: 0,
      policyViolations: 2,
      riskLevel: 'MEDIUM',
    },
  ],
};

describe('ManagerDashboard attendance view', () => {
  beforeEach(() => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'manager-dashboard') return { data: dashboardData, isLoading: false, isError: false };
      if (key === 'manager-dashboard-self-profile') return { data: managerProfile, isLoading: false };
      if (key === 'manager-own-attendance-period-view') return { data: { ...periodView, scope: 'SELF', workers: [] }, isLoading: false };
      if (key === 'manager-team-attendance-period-view') return { data: periodView, isLoading: false };
      return { data: undefined, isLoading: false, isError: false };
    });
  });

  it('shows own and team attendance with worker-level policy ledger rollups', () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <ManagerDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('My Attendance')).toBeInTheDocument();
    expect(screen.getAllByText('Team Attendance').length).toBeGreaterThan(0);
    expect(screen.getByText('Team ledger')).toBeInTheDocument();
    expect(screen.getAllByText('Mina Soliman').length).toBeGreaterThan(0);
    expect(screen.getByText('Payable 8h')).toBeInTheDocument();
    expect(screen.getByText('Late 10m')).toBeInTheDocument();
    expect(screen.getAllByText('88%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MEDIUM').length).toBeGreaterThan(0);
    expect(screen.getByText('Score 88%')).toBeInTheDocument();
  });
});
