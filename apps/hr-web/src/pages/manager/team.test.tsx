import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function renderTeam() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/manager/team?worker=${selectedWorkerId}`]}>
        <Routes>
          <Route path="/manager/team" element={<ManagerTeam />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

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
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: {} } });
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
});
