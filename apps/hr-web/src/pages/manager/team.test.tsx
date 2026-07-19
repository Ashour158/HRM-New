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

const selectedWorkerId = '00000000-0000-0000-0000-000000000011';

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

describe('ManagerTeam', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    useApiQueryMock.mockReturnValue({
      data: {
        directReports: [selectedMember],
        selectedMember,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
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
});
