import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeProfile } from './profile';

const useApiQueryMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
}));

vi.mock('@/hooks/use-field-access', () => ({
  useFieldAccess: () => ({
    data: { decision: 'VISIBLE' },
    isLoading: false,
  }),
}));

vi.mock('@/components/common/allowed-actions', () => ({
  AllowedActions: () => <div data-testid="allowed-actions" />,
}));

const profile = {
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
  documents: [],
};

const performanceImpact = {
  actionPlan: {
    workerId: profile.id,
    employeeName: 'Amina Nour',
    riskLevel: 'LOW',
    currentPerformance: {
      latestRating: 4.4,
      averageGoalProgress: 82,
      peerAverageRating: 4.6,
      activeGoalCount: 3,
      openDevelopmentPlan: false,
    },
    progressTrend: 'Improving',
    checkInCadence: 'Monthly performance conversation',
    recommendedActions: ['Keep current peer feedback rhythm.'],
  },
  feedbackSummary: {
    averageRating: 4.6,
    responseCount: 4,
    anonymousResponseCount: 2,
    conciseFeedback: 'Trusted partner with strong collaboration.',
    dimensionAverages: { communication: 4.7, teamwork: 4.5 },
  },
  nineBox: {
    performanceScore: 88,
    potentialScore: 84,
    performanceBand: 'HIGH',
    potentialBand: 'HIGH',
    box: 'Star',
  },
  goals: {
    total: 4,
    active: 3,
    achieved: 1,
    atRisk: 0,
    averageProgress: 82,
  },
};

describe('EmployeeProfile', () => {
  beforeEach(() => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-profile') {
        return { data: profile, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (key === 'employee-profile-performance') {
        return { data: performanceImpact, isLoading: false, error: null, refetch: vi.fn() };
      }
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
  });

  it('shows performance impact on the employee profile', async () => {
    render(<EmployeeProfile />);

    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

    expect(screen.getByText('Performance Impact')).toBeInTheDocument();
    expect(screen.getByText('Star')).toBeInTheDocument();
    expect(screen.getByText('4 peer responses')).toBeInTheDocument();
    expect(screen.getByText('Trusted partner with strong collaboration.')).toBeInTheDocument();
  });

  it('shows a loading state while performance impact is loading', async () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-profile') {
        return { data: profile, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (key === 'employee-profile-performance') {
        return { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
      }
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    const { container } = render(<EmployeeProfile />);

    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows an empty state when no performance signal exists', async () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-profile') {
        return { data: profile, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (key === 'employee-profile-performance') {
        return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
      }
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    render(<EmployeeProfile />);

    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

    expect(screen.getByText('No performance signal yet')).toBeInTheDocument();
  });

  it('shows an error state when performance impact cannot load', async () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-profile') {
        return { data: profile, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (key === 'employee-profile-performance') {
        return { data: undefined, isLoading: false, error: new Error('Performance unavailable'), refetch: vi.fn() };
      }
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    render(<EmployeeProfile />);

    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

    expect(screen.getByText('Performance data could not be loaded')).toBeInTheDocument();
  });
});
