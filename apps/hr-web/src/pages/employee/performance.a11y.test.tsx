import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { EmployeePerformance } from './performance';

const useApiQueryMock = vi.fn();

const worker = {
  id: '00000000-0000-0000-0000-000000000020',
  firstName: 'Regular',
  lastName: 'Employee',
  email: 'employee@example.com',
};

const eligibleReviewees = [
  {
    id: '00000000-0000-0000-0000-000000000011',
    firstName: 'Line',
    lastName: 'Manager',
    relationshipType: 'DIRECT_REPORT',
  },
];

const feedbackCycles = [
  { id: { value: '00000000-0000-0000-0000-000000000201' }, name: 'Smoke Test', status: 'ACTIVE' },
];

const notifications = [
  { id: 'note-1', category: 'REVIEW', title: 'Cycle opened', body: 'A new review cycle has started.', createdAt: '2026-07-01T00:00:00.000Z' },
];

const goals = [
  { id: 'goal-1', title: 'Ship the onboarding revamp', targetValue: 100, currentValue: 60, status: 'ACTIVE' },
];

const feedbackRequests = [
  { id: 'fb-1', cycleId: 'cycle-1', revieweeId: 'reviewee-1', reviewerId: worker.id, relationshipType: 'PEER', status: 'PENDING', isAnonymous: true },
];

const actionPlan = {
  actionPlan: {
    workerId: worker.id,
    employeeName: 'Regular Employee',
    riskLevel: 'LOW',
    recommendedActions: ['Keep current cadence.'],
  },
  feedbackSummary: { averageRating: 4.5, responseCount: 3, anonymousResponseCount: 1, conciseFeedback: 'Great collaborator.' },
  nineBox: { performanceScore: 80, potentialScore: 75, performanceBand: 'HIGH', potentialBand: 'HIGH', box: 'Star' },
  goals: { total: 1, active: 1, achieved: 0, atRisk: 0, averageProgress: 60 },
};

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      email: 'employee@example.com',
      firstName: 'Regular',
      lastName: 'Employee',
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
}));

describe('EmployeePerformance accessibility', () => {
  it('renders without accessibility violations', async () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-performance-worker') return { data: worker };
      if (key === 'employee-performance-eligible-feedback-reviewees') return { data: eligibleReviewees };
      if (key === 'employee-performance-feedback-cycles') return { data: feedbackCycles };
      if (key === 'employee-performance-notifications') return { data: notifications, refetch: vi.fn() };
      if (key === 'employee-performance-goals') return { data: goals, refetch: vi.fn() };
      if (key === 'employee-performance-feedback-requests') return { data: feedbackRequests, refetch: vi.fn() };
      if (key === 'employee-performance-action-plan') return { data: actionPlan, refetch: vi.fn() };
      return { data: undefined, refetch: vi.fn() };
    });

    const { container } = render(<EmployeePerformance />);

    expect(screen.getByRole('heading', { name: /Regular Employee/i })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
