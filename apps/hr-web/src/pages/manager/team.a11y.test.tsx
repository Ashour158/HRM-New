import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  Bar: () => null,
  BarChart: () => <div data-testid="bar-chart" />,
  CartesianGrid: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const selectedWorkerId = '00000000-0000-0000-0000-000000000011';

const directReport = {
  id: selectedWorkerId,
  employeeId: 'EMP-100',
  firstName: 'Mona',
  lastName: 'Saleh',
  email: 'mona.saleh@example.com',
  hireDate: '2024-01-15',
  status: 'ACTIVE',
  jobTitle: 'Product Specialist',
  departmentName: 'Product',
};

describe('ManagerTeam accessibility', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'manager-team') {
        return {
          data: { directReports: [directReport] },
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (key === 'manager-team-attrition-risk') {
        return { data: [], isLoading: false };
      }
      return { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    });
  });

  it('renders the team list without accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/manager/team']}>
        <Routes>
          <Route path="/manager/team" element={<ManagerTeam />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByText('Mona Saleh')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });

  it('renders the selected member detail view without accessibility violations', async () => {
    const selectedMember = {
      ...directReport,
      compensationBand: 'P3',
      performanceRating: 4.2,
      lastReviewDate: '2026-06-05',
      goals: [{ id: 'goal-1', title: 'Launch readiness', status: 'IN_PROGRESS', progress: 55 }],
      performanceImpact: {
        actionPlan: {
          riskLevel: 'MEDIUM' as const,
          checkInCadence: 'Twice-weekly manager action-plan check-in',
          recommendedActions: ['Advance action plan objective: Raise launch goal delivery above 75%'],
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
          conciseFeedback: 'Average peer rating is 4.5. Strengths: Keeps peers aligned. Focus: Escalate delivery risks earlier.',
        },
        nineBox: {
          box: 'Core contributor',
          performanceScore: 72,
          potentialScore: 66,
        },
      },
    };
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'manager-team') {
        return {
          data: { directReports: [directReport], selectedMember },
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (key === 'manager-team-attrition-risk') {
        return { data: [], isLoading: false };
      }
      return { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    });

    const { container } = render(
      <MemoryRouter initialEntries={[`/manager/team?worker=${selectedWorkerId}`]}>
        <Routes>
          <Route path="/manager/team" element={<ManagerTeam />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));
    expect(screen.getByText('360 feedback')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });

  it('renders the compensation tab without accessibility violations', async () => {
    const selectedMember = {
      ...directReport,
      compensationBand: 'P3',
      goals: [],
    };
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'manager-team') {
        return {
          data: { directReports: [directReport], selectedMember },
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (key === 'manager-team-attrition-risk') {
        return { data: [], isLoading: false };
      }
      return { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    });

    const { container } = render(
      <MemoryRouter initialEntries={[`/manager/team?worker=${selectedWorkerId}`]}>
        <Routes>
          <Route path="/manager/team" element={<ManagerTeam />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Compensation' }));
    expect(screen.getByRole('heading', { name: 'Compensation' })).toBeInTheDocument();
    expect(screen.getByText('P3')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
