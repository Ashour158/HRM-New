import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ManagerTeam } from './team';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) =>
    selector({ addNotification: addNotificationMock }),
}));

vi.mock('@/components/common/allowed-actions', () => ({
  AllowedActions: (props: { aggregateType: string; aggregateId?: string }) => (
    <div
      data-testid={`allowed-actions-${props.aggregateType}`}
      data-aggregate-id={props.aggregateId ?? ''}
    />
  ),
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
  managerId: managerWorkerId,
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

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderTeam(path: string = `/manager/team?worker=${selectedWorkerId}`) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/manager/team" element={<ManagerTeam />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

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

describe('ManagerTeam', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url.startsWith('/manager/team')) {
        return apiResponse({ directReports: [selectedMember], selectedMember });
      }
      if (url.startsWith('/intelligence/attrition-risk/tenant/')) {
        return apiResponse([]);
      }
      if (url.startsWith('/employee/profile')) {
        return apiResponse(managerProfile);
      }
      if (url.startsWith('/time/attendance/reports/period-view')) {
        return apiResponse(teamAttendancePeriodView);
      }
      if (url.startsWith('/time/attendance/daily-ledger')) {
        return apiResponse(dailyLedger);
      }
      if (url.startsWith('/performance/analytics/manager/')) {
        return apiResponse(performanceDashboard);
      }
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: {} } });
  });

  describe('team activity widget on the list view', () => {
    it('renders upcoming anniversaries and recent joins from the already-fetched roster', async () => {
      // Compute dates relative to "now" (UTC, calendar-day granularity) so the
      // assertions stay true no matter when the suite runs, mirroring the exact
      // day-math `computeUpcomingTeamEvents` itself uses.
      const now = new Date();
      const anniversaryTarget = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 8),
      );
      const anniversaryHireDate = new Date(
        Date.UTC(
          anniversaryTarget.getUTCFullYear() - 4,
          anniversaryTarget.getUTCMonth(),
          anniversaryTarget.getUTCDate(),
        ),
      ).toISOString(); // 8 days away, 4th anniversary
      const recentHireDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7),
      ).toISOString(); // 7 days ago

      apiClientGetMock.mockImplementation((url: string) => {
        if (url.startsWith('/manager/team')) {
          return apiResponse({
            directReports: [
              {
                id: 'w-anniversary',
                employeeId: 'EMP-200',
                firstName: 'Anniversary',
                lastName: 'Worker',
                email: 'anniversary@example.com',
                hireDate: anniversaryHireDate,
                status: 'ACTIVE',
              },
              {
                id: 'w-new-hire',
                employeeId: 'EMP-201',
                firstName: 'Newly',
                lastName: 'Hired',
                email: 'newly.hired@example.com',
                hireDate: recentHireDate,
                status: 'ACTIVE',
              },
            ],
          });
        }
        if (url.startsWith('/intelligence/attrition-risk/tenant/')) {
          return apiResponse([]);
        }
        return apiResponse({});
      });

      renderTeam('/manager/team');

      const cardTitle = await screen.findByText('Team Activity');
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

    it('shows the empty state when no direct reports have upcoming activity', async () => {
      const now = new Date();
      // ~183 days from today's month/day, several years ago: comfortably outside
      // the 30-day anniversary and recent-join windows regardless of when the
      // suite runs.
      const tenuredHireDate = new Date(
        Date.UTC(now.getUTCFullYear() - 8, now.getUTCMonth(), now.getUTCDate() + 183),
      ).toISOString();

      apiClientGetMock.mockImplementation((url: string) => {
        if (url.startsWith('/manager/team')) {
          return apiResponse({
            directReports: [
              {
                id: 'w-tenured',
                employeeId: 'EMP-300',
                firstName: 'Long',
                lastName: 'Tenured',
                email: 'long.tenured@example.com',
                hireDate: tenuredHireDate,
                status: 'ACTIVE',
              },
            ],
          });
        }
        if (url.startsWith('/intelligence/attrition-risk/tenant/')) {
          return apiResponse([]);
        }
        return apiResponse({});
      });

      renderTeam('/manager/team');

      await screen.findByText('Team Activity');
      expect(
        screen.getByText('No upcoming anniversaries or new joins in the next 30 days.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Upcoming work anniversaries')).not.toBeInTheDocument();
      expect(screen.queryByText('Recent joins')).not.toBeInTheDocument();
    });
  });

  it('shows selected member 360 and action-plan impact in the performance tab', async () => {
    renderTeam();

    await userEvent.click(await screen.findByRole('tab', { name: 'Performance' }));

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

  it('uses the real WorkerProfile aggregate (not a fabricated one) for the header actions', async () => {
    renderTeam();

    const workerActions = await screen.findByTestId('allowed-actions-WORKER');
    expect(workerActions).toHaveAttribute('data-aggregate-id', selectedWorkerId);
    // The old, bogus aggregate types must be gone entirely, not just hidden.
    expect(screen.queryByTestId('allowed-actions-PERFORMANCE')).not.toBeInTheDocument();
    expect(screen.queryByTestId('allowed-actions-COMPENSATION')).not.toBeInTheDocument();
  });

  it('assigns a SMART goal to the direct report via the real CreateGoal command', async () => {
    renderTeam();
    await userEvent.click(await screen.findByRole('tab', { name: 'Performance' }));
    await userEvent.click(screen.getByRole('button', { name: 'Assign Goal' }));

    await userEvent.type(screen.getByLabelText('Title'), 'Improve onboarding time');
    await userEvent.type(screen.getByLabelText('Metric name'), 'Days to productivity');
    await userEvent.type(screen.getByLabelText('Target value'), '30');
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-11-01' } });
    await userEvent.type(screen.getByLabelText('Specific'), 'Reduce onboarding ramp time');
    await userEvent.type(screen.getByLabelText('Measurable'), 'Track days to first ship');
    await userEvent.type(screen.getByLabelText('Achievable'), 'Prior cohort hit 35 days');
    await userEvent.type(screen.getByLabelText('Relevant'), 'Speeds up team delivery');
    await userEvent.type(screen.getByLabelText('Time-bound'), 'Complete by end of Q3');

    const submit = screen.getByRole('button', { name: 'Assign goal' });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/performance/goals',
      expect.objectContaining({
        workerId: selectedWorkerId,
        title: 'Improve onboarding time',
        metricName: 'Days to productivity',
        targetValue: 30,
        startDate: '2026-08-01',
        dueDate: '2026-11-01',
        smartCriteria: {
          specific: 'Reduce onboarding ramp time',
          measurable: 'Track days to first ship',
          achievable: 'Prior cohort hit 35 days',
          relevant: 'Speeds up team delivery',
          timeBound: 'Complete by end of Q3',
        },
      }),
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('starts a Performance Improvement Plan via the real CreatePerformanceImprovementPlan command, using the report manager as the real aggregate context', async () => {
    renderTeam();
    await userEvent.click(await screen.findByRole('tab', { name: 'Performance' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start Improvement Plan' }));

    await userEvent.type(screen.getByLabelText('Check-in cadence'), 'Weekly');
    await userEvent.type(screen.getByLabelText('Objectives (one per line)'), 'Improve code review turnaround');

    await userEvent.click(screen.getByRole('button', { name: 'Start plan' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/performance/improvement-plans',
      expect.objectContaining({
        workerId: selectedWorkerId,
        managerId: managerWorkerId,
        checkInCadence: 'Weekly',
        objectives: ['Improve code review turnaround'],
      }),
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('does not offer PIP lifecycle actions that RBAC would reject for a bare MANAGER role', async () => {
    renderTeam();
    await userEvent.click(await screen.findByRole('tab', { name: 'Performance' }));

    // RecordPerformanceImprovementPlanCheckpoint, ActivatePerformanceImprovementPlan,
    // EnterReviewPerformanceImprovementPlan, CompletePerformanceImprovementPlan,
    // ClosePerformanceImprovementPlan, ExtendPerformanceImprovementPlan, and
    // TerminatePerformanceImprovementPlan are all RBAC- or allowlist-denied for MANAGER;
    // none of them should be rendered as a clickable action.
    expect(screen.queryByRole('button', { name: /checkpoint/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit.*review/i })).not.toBeInTheDocument();
    expect(screen.getByText(/require HR performance admin scope/i)).toBeInTheDocument();
  });

  it('shows compensation as read-only with an explicit deferred reason instead of a broken action widget', async () => {
    renderTeam();
    await userEvent.click(await screen.findByRole('tab', { name: 'Compensation' }));

    expect(screen.getByText('P3')).toBeInTheDocument();
    expect(
      screen.getByText(/MANAGER role does not hold any compensation command permission/i),
    ).toBeInTheDocument();
    // No compensation mutation should ever be offered to a manager: there is no
    // COMPENSATION_ADMIN_ROLES-gated command a bare MANAGER can call.
    expect(screen.queryByRole('button', { name: /approve|recommend|change/i })).not.toBeInTheDocument();
    expect(apiClientPostMock).not.toHaveBeenCalledWith(expect.stringContaining('/hr/compensation'), expect.anything());
  });

  it('shows a scope=TEAM attendance roster, who is in today, and exceptions on the team list view', async () => {
    renderTeam('/manager/team');

    expect(await screen.findByText('Team Attendance')).toBeInTheDocument();
    // Who's in today roster, sourced from the scoped daily-ledger row.
    expect(screen.getByText('PRESENT')).toBeInTheDocument();
    // Exception queue surfaced for manager attention.
    expect(screen.getByText('Late arrival exceeds grace window')).toBeInTheDocument();
    expect(screen.getAllByText('MEDIUM').length).toBeGreaterThan(0);
    // Full period roster (not capped), from scope=TEAM period-view.
    expect(screen.getByText('Team roster - Weekly')).toBeInTheDocument();
    expect(screen.getAllByText('Mona Saleh').length).toBeGreaterThan(0);
  });

  it('shows the manager-scoped team performance distribution and talent grid', async () => {
    renderTeam('/manager/team');

    expect(await screen.findByText('Team Performance')).toBeInTheDocument();
    expect(screen.getByText('Rating distribution')).toBeInTheDocument();
    expect(screen.getByText('Talent grid')).toBeInTheDocument();
    expect(screen.getByText('Core contributor')).toBeInTheDocument();
    expect(screen.getByText('Action plans')).toBeInTheDocument();
    expect(screen.getAllByTestId('bar-chart').length).toBeGreaterThan(0);
  });
});
