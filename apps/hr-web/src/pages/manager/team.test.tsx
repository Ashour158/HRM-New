import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ManagerTeam } from './team';

const useApiQueryMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
}));

vi.mock('@/components/common/allowed-actions', () => ({
  AllowedActions: () => <div data-testid="allowed-actions" />,
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

const selectedWorkerId = '00000000-0000-0000-0000-000000000011';
const managerWorkerId = '00000000-0000-0000-0000-000000000099';

const selectedMember = {
  id: selectedWorkerId,
  employeeId: 'EMP-100',
  firstName: 'Mona',
  lastName: 'Saleh',
  email: 'mona.saleh@example.com',
  hireDate: '2024-01-15',
  status: 'ACTIVE',
  jobTitle: 'Product Specialist',
  departmentName: 'Product',
  managerName: 'Line Manager',
  legalEntityName: 'Nexus USA LLC',
  compensationBand: 'P3',
  performanceRating: 4.2,
  lastReviewDate: '2026-06-05',
  goals: [
    {
      id: 'goal-1',
      title: 'Launch readiness',
      status: 'IN_PROGRESS',
      progress: 55,
    },
  ],
  performanceImpact: {
    actionPlan: {
      riskLevel: 'MEDIUM',
      checkInCadence: 'Twice-weekly manager action-plan check-in',
      recommendedActions: [
        'Advance action plan objective: Raise launch goal delivery above 75%',
      ],
      currentPerformance: {
        latestRating: 4.2,
        averageGoalProgress: 55,
        peerAverageRating: 4.5,
        activeGoalCount: 1,
        openDevelopmentPlan: true,
      },
    },
    feedbackSummary: {
      averageRating: 4.5,
      responseCount: 3,
      anonymousResponseCount: 1,
      conciseFeedback:
        'Average peer rating is 4.5. Strengths: Keeps peers aligned. Focus: Escalate delivery risks earlier.',
    },
    nineBox: {
      box: 'Core contributor',
      performanceScore: 72,
      potentialScore: 66,
    },
  },
};

const managerProfile = {
  id: managerWorkerId,
  employeeId: 'EMP-001',
  firstName: 'David',
  lastName: 'Chen',
  email: 'david.chen@example.com',
  hireDate: '2020-01-01',
  status: 'ACTIVE',
};

const teamAttendancePeriodView = {
  periodStart: '2026-07-07',
  periodEnd: '2026-07-13',
  range: 'WEEKLY',
  scope: 'TEAM',
  totals: {
    employeeDays: 10,
    present: 8,
    absent: 1,
    onLeave: 1,
    exceptions: 2,
    payableHours: 76,
    deductionHours: 1,
    overtimeHours: 4,
    geofenceViolations: 0,
    lateMinutes: 30,
    missingCheckout: 0,
    payrollReady: 8,
    undertimeMinutes: 0,
  },
  workers: [
    {
      workerId: selectedWorkerId,
      employeeId: 'EMP-100',
      name: 'Mona Saleh',
      departmentName: 'Product',
      employeeDays: 5,
      present: 4,
      absent: 1,
      onLeave: 0,
      exceptions: 1,
      payableHours: 38,
      deductionHours: 0.5,
      overtimeHours: 2,
      geofenceViolations: 0,
      lateMinutes: 15,
      missingCheckout: 0,
      payrollReady: 4,
      undertimeMinutes: 0,
    },
  ],
};

const dailyLedger = {
  workDate: '2026-07-13',
  rows: [
    {
      worker: {
        workerId: selectedWorkerId,
        employeeId: 'EMP-100',
        name: 'Mona Saleh',
        departmentName: 'Product',
      },
      status: 'PRESENT',
      firstCheckInAt: '2026-07-13T06:05:00.000Z',
      latestCheckOutAt: undefined,
      exceptions: [],
    },
  ],
  summary: {
    totalEmployees: 1,
    present: 1,
    absent: 0,
    onLeave: 0,
    late: 0,
    missingCheckout: 0,
    exceptions: 1,
    payrollReady: 0,
  },
  exceptionQueue: [
    {
      workerId: selectedWorkerId,
      workerName: 'Mona Saleh',
      description: 'Late arrival exceeds grace window',
      severity: 'MEDIUM',
      status: 'OPEN',
    },
  ],
};

const performanceDashboard = {
  managerId: managerWorkerId,
  managerName: 'David Chen',
  reportCount: 1,
  analytics: {
    ratingDistribution: [{ rating: 4, count: 1 }],
    goalMetrics: { total: 3, active: 2, achieved: 1, atRisk: 1, averageProgress: 62 },
    nineBox: [{ workerId: selectedWorkerId, employeeName: 'Mona Saleh', performanceScore: 72, potentialScore: 66, box: 'Core contributor' }],
    recognitions: [{ workerId: selectedWorkerId, employeeName: 'Mona Saleh', score: 88, reason: 'Recognized for rating 4.2 with 88% performance score.' }],
    actionPlans: [{ workerId: selectedWorkerId, employeeName: 'Mona Saleh', riskLevel: 'MEDIUM', progressTrend: 'IMPROVING', recommendedActions: ['Advance action plan objective: Raise launch goal delivery above 75%'] }],
  },
};

function setupQueries(overrides: Record<string, unknown> = {}) {
  useApiQueryMock.mockImplementation((queryKey: unknown) => {
    const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
    if (key in overrides) return overrides[key];
    if (key === 'manager-team') {
      return {
        data: { directReports: [selectedMember], selectedMember },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (key === 'manager-team-attrition-risk') return { data: [], isLoading: false };
    if (key === 'manager-team-self-profile') return { data: managerProfile, isLoading: false };
    if (key === 'manager-team-attendance-period-view') return { data: teamAttendancePeriodView, isLoading: false };
    if (key === 'manager-team-daily-ledger') return { data: dailyLedger, isLoading: false };
    if (key === 'manager-team-performance-analytics') return { data: performanceDashboard, isLoading: false };
    return { data: undefined, isLoading: false };
  });
}

describe('ManagerTeam', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    setupQueries();
  });

  describe('team activity widget on the list view', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-12T00:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders upcoming anniversaries and recent joins from the already-fetched roster', () => {
      useApiQueryMock.mockReturnValue({
        data: {
          directReports: [
            {
              id: 'w-anniversary',
              employeeId: 'EMP-200',
              firstName: 'Anniversary',
              lastName: 'Worker',
              email: 'anniversary@example.com',
              hireDate: '2022-07-20T00:00:00.000Z', // 8 days away, 4th anniversary
              status: 'ACTIVE',
            },
            {
              id: 'w-new-hire',
              employeeId: 'EMP-201',
              firstName: 'Newly',
              lastName: 'Hired',
              email: 'newly.hired@example.com',
              hireDate: '2026-07-05T00:00:00.000Z', // 7 days ago
              status: 'ACTIVE',
            },
          ],
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/manager/team']}>
          <Routes>
            <Route path="/manager/team" element={<ManagerTeam />} />
          </Routes>
        </MemoryRouter>,
      );

      const cardTitle = screen.getByText('Team Activity');
      const card = cardTitle.parentElement?.parentElement as HTMLElement;

      expect(within(card).getByText('Upcoming work anniversaries')).toBeInTheDocument();
      expect(within(card).getByText('Anniversary Worker')).toBeInTheDocument();
      expect(within(card).getByText('4 years')).toBeInTheDocument();

      expect(within(card).getByText('Recent joins')).toBeInTheDocument();
      expect(within(card).getByText('Newly Hired')).toBeInTheDocument();
      expect(within(card).getByText('7 days ago')).toBeInTheDocument();

      // Both workers still show up in the direct-reports table below the card.
      expect(screen.getAllByText('Anniversary Worker')).toHaveLength(2);
      expect(screen.getAllByText('Newly Hired')).toHaveLength(2);
    });

    it('shows the empty state when no direct reports have upcoming activity', () => {
      useApiQueryMock.mockReturnValue({
        data: {
          directReports: [
            {
              id: 'w-tenured',
              employeeId: 'EMP-300',
              firstName: 'Long',
              lastName: 'Tenured',
              email: 'long.tenured@example.com',
              hireDate: '2018-01-15T00:00:00.000Z', // far outside the 30-day window
              status: 'ACTIVE',
            },
          ],
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/manager/team']}>
          <Routes>
            <Route path="/manager/team" element={<ManagerTeam />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText('Team Activity')).toBeInTheDocument();
      expect(
        screen.getByText('No upcoming anniversaries or new joins in the next 30 days.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Upcoming work anniversaries')).not.toBeInTheDocument();
      expect(screen.queryByText('Recent joins')).not.toBeInTheDocument();
    });
  });

  it('shows selected member 360 and action-plan impact in the performance tab', async () => {
    render(
      <MemoryRouter
        initialEntries={[`/manager/team?worker=${selectedWorkerId}`]}
      >
        <Routes>
          <Route path="/manager/team" element={<ManagerTeam />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

    expect(screen.getByText('360 feedback')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('3 responses')).toBeInTheDocument();
    expect(screen.getByText('Medium attention')).toBeInTheDocument();
    expect(
      screen.getByText('Twice-weekly manager action-plan check-in'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Advance action plan objective: Raise launch goal delivery above 75%',
      ),
    ).toBeInTheDocument();
  });

  it('shows a scope=TEAM attendance roster, who is in today, and exceptions on the team list view', () => {
    render(
      <MemoryRouter initialEntries={['/manager/team']}>
        <Routes>
          <Route path="/manager/team" element={<ManagerTeam />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Team Attendance')).toBeInTheDocument();
    // Who's in today roster, sourced from the scoped daily-ledger row.
    expect(screen.getByText('PRESENT')).toBeInTheDocument();
    // Exception queue surfaced for manager attention.
    expect(screen.getByText('Late arrival exceeds grace window')).toBeInTheDocument();
    expect(screen.getAllByText('MEDIUM').length).toBeGreaterThan(0);
    // Full period roster (not capped), from scope=TEAM period-view.
    expect(screen.getByText('Team roster - Weekly')).toBeInTheDocument();
    expect(screen.getAllByText('Mona Saleh').length).toBeGreaterThan(0);
  });

  it('shows the manager-scoped team performance distribution and talent grid', () => {
    render(
      <MemoryRouter initialEntries={['/manager/team']}>
        <Routes>
          <Route path="/manager/team" element={<ManagerTeam />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Team Performance')).toBeInTheDocument();
    expect(screen.getByText('Rating distribution')).toBeInTheDocument();
    expect(screen.getByText('Talent grid')).toBeInTheDocument();
    expect(screen.getByText('Core contributor')).toBeInTheDocument();
    expect(screen.getByText('Action plans')).toBeInTheDocument();
    expect(screen.getAllByTestId('bar-chart').length).toBeGreaterThan(0);
  });
});
