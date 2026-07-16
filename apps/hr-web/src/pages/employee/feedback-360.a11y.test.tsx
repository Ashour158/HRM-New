import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeFeedback360 } from './feedback-360';

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();

const workerId = '00000000-0000-4000-8000-000000000501';

const reviewerCycles = [
  {
    id: 'cycle-1',
    subjectWorkerId: 'subject-1',
    reviewers: [`peer:${workerId}`],
    competencies: ['Communication', 'Execution'],
    responses: [],
    status: 'IN_PROGRESS',
  },
];

const subjectCycles = [
  {
    id: 'cycle-2',
    subjectWorkerId: workerId,
    reviewers: [`peer:reviewer-1`],
    competencies: ['Communication'],
    responses: [{ reviewerWorkerId: 'reviewer-1', competencyScores: { Communication: 4 } }],
    status: 'COMPLETED',
  },
];

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

describe('EmployeeFeedback360 accessibility', () => {
  it('renders without accessibility violations', async () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-feedback-360-worker') {
        return { data: { id: workerId }, error: null, refetch: vi.fn() };
      }
      if (key === 'employee-feedback-360-reviewer-cycles') {
        return { data: reviewerCycles, error: null, refetch: vi.fn() };
      }
      if (key === 'employee-feedback-360-subject-cycles') {
        return { data: subjectCycles, error: null, refetch: vi.fn() };
      }
      return { data: undefined, error: null, refetch: vi.fn() };
    });
    useApiMutationMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    const { container } = render(<EmployeeFeedback360 />);

    expect(screen.getByRole('heading', { name: /Feedback 360/i })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
