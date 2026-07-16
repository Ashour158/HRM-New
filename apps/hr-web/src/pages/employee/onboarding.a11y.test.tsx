import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeOnboarding } from './onboarding';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();

const worker = {
  id: '00000000-0000-0000-0000-000000000030',
  firstName: 'Nadia',
  lastName: 'Khalil',
  jobTitle: 'Support Specialist',
  departmentName: 'Customer Success',
};

const plan = {
  id: 'plan-1',
  workerId: worker.id,
  startDate: '2026-07-01',
  status: 'IN_PROGRESS',
  assignedBuddyId: 'buddy-1',
  preboardingPortalStatus: 'ACTIVE',
  probationReviewDate: '2026-10-01',
  probationStatus: 'ON_TRACK',
};

const tasks = [
  {
    id: 'task-1',
    onboardingPlanId: plan.id,
    title: 'Sign employment contract',
    description: 'Review and sign the employment contract.',
    ownerGroup: 'HR',
    dueDate: '2026-07-05',
    status: 'PENDING',
  },
  {
    id: 'task-2',
    onboardingPlanId: plan.id,
    title: 'Provision laptop and accounts',
    description: 'IT sets up hardware and access.',
    ownerGroup: 'IT',
    dueDate: '2026-07-03',
    status: 'COMPLETED',
  },
];

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      firstName: worker.firstName,
      lastName: worker.lastName,
      avatarUrl: undefined,
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('EmployeeOnboarding accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/hr/onboarding/plans/worker/${worker.id}`) return apiResponse(plan);
      if (url === `/hr/onboarding/tasks/plan/${plan.id}`) return apiResponse(tasks);
      return apiResponse(null);
    });
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-onboarding-worker') return { data: worker, isLoading: false };
      return { data: undefined, isLoading: false };
    });
    useApiMutationMock.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EmployeeOnboarding />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: /Welcome, Nadia/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Sign employment contract')).toBeInTheDocument());
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
