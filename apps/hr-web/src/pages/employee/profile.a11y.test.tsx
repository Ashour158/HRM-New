import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeProfile } from './profile';

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
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
  phone: '+20 100 000 0000',
  dateOfBirth: '1990-01-01',
  hireDate: '2025-01-01',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  department: 'Design',
  jobTitle: 'Product Designer',
  manager: 'David Chen',
  legalEntity: 'Enterprise HR',
  documents: [{ id: 'doc-1', name: 'Passport.pdf', type: 'PASSPORT', uploadedAt: '2026-01-01' }],
};

const performanceImpact = {
  actionPlan: {
    riskLevel: 'LOW',
    currentPerformance: {
      latestRating: 4.4,
      averageGoalProgress: 82,
      peerAverageRating: 4.6,
      activeGoalCount: 3,
      openDevelopmentPlan: false,
    },
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
  goals: { total: 4, active: 3, achieved: 1, atRisk: 0, averageProgress: 82 },
};

describe('EmployeeProfile accessibility', () => {
  it('renders without accessibility violations', async () => {
    useApiMutationMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
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

    const { container } = render(<EmployeeProfile />);

    expect(screen.getByRole('heading', { name: /Amina Nour/i })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
