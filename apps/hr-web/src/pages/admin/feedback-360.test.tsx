import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminFeedback360 } from './feedback-360';
import { EmployeeFeedback360 } from '../employee/feedback-360';

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: '00000000-0000-0000-0000-000000000020',
      tenantId: '00000000-0000-0000-0000-000000000001',
      email: 'employee@example.com',
      firstName: 'Regular',
      lastName: 'Employee',
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

vi.mock('@/components/common/allowed-actions', () => ({
  AllowedActions: ({ aggregateType, state }: { aggregateType: string; state?: string }) => (
    <div data-testid="allowed-actions">{aggregateType}:{state}</div>
  ),
}));

vi.mock('@/components/common/audit-trail', () => ({
  AuditTrail: () => <div data-testid="audit-trail" />,
}));

const cycles = [
  {
    id: { value: '00000000-0000-0000-0000-000000000301' },
    subjectWorkerId: { value: '00000000-0000-0000-0000-000000000020' },
    reviewers: [
      'self:00000000-0000-0000-0000-000000000020',
      'manager:00000000-0000-0000-0000-000000000021',
      'peer:00000000-0000-0000-0000-000000000022',
    ],
    startDate: '2026-06-01T00:00:00.000Z',
    endDate: '2026-06-30T00:00:00.000Z',
    status: 'IN_PROGRESS',
    aggregateVersion: 2,
  },
  {
    id: '00000000-0000-0000-0000-000000000302',
    subjectWorkerId: '00000000-0000-0000-0000-000000000020',
    reviewers: ['manager:00000000-0000-0000-0000-000000000021'],
    status: 'COMPLETED',
    aggregateVersion: 3,
  },
];

describe('Feedback 360 pages', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    useApiMutationMock.mockReset();
    useApiMutationMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('renders admin cycles with status and allowed lifecycle actions', () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'engagement-feedback-360-cycles') {
        return { data: cycles, isLoading: false, isError: false };
      }
      return { data: undefined, isLoading: false, isError: false };
    });

    render(<AdminFeedback360 />);

    expect(screen.getByRole('heading', { name: 'Feedback 360' })).toBeInTheDocument();
    expect(screen.getAllByText('IN_PROGRESS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThan(0);
    expect(screen.getByText('3 reviewers')).toBeInTheDocument();
    expect(screen.getByTestId('allowed-actions')).toHaveTextContent('Feedback360Cycle:IN_PROGRESS');
    expect(screen.getByRole('button', { name: 'Create cycle' })).toBeInTheDocument();
  });

  it('renders employee pending tasks and closed results from engagement cycles', async () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-feedback-360-worker') {
        return { data: { id: '00000000-0000-0000-0000-000000000020' }, isLoading: false, isError: false };
      }
      if (key === 'employee-feedback-360-subject-cycles') {
        return { data: cycles, isLoading: false, isError: false };
      }
      if (key === 'employee-feedback-360-reviewer-cycles') {
        return { data: cycles, isLoading: false, isError: false };
      }
      return { data: undefined, isLoading: false, isError: false };
    });

    render(<EmployeeFeedback360 />);

    expect(screen.getByRole('heading', { name: 'Feedback 360' })).toBeInTheDocument();
    expect(screen.getByText('My 360 tasks')).toBeInTheDocument();
    expect(screen.getAllByText('Self review').length).toBeGreaterThan(0);
    expect(screen.getByText('My results')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'My results' }));
    expect(await screen.findByText('Closed 360 summary')).toBeInTheDocument();
  });
});
