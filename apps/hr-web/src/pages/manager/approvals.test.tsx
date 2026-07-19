import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerApprovals } from './approvals';

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) =>
    selector({ addNotification: vi.fn() }),
}));

vi.mock('@/components/common/next-actions', () => ({
  NextActions: () => null,
}));

const workflowChain = {
  id: 'chain-1',
  commandName: 'DelegateApprovalStep',
  aggregateType: 'WorkflowChain',
  aggregateId: null,
  status: 'IN_PROGRESS',
  currentStepOrder: 1,
  createdAt: '2026-07-01T00:00:00.000Z',
  steps: [
    {
      id: 'step-1',
      code: 'STEP1',
      label: 'Manager Approval',
      order: 1,
      approverRole: 'MANAGER',
      approverWorkerId: null,
      delegatedToWorkerId: null,
      state: 'PENDING' as const,
      slaDueAt: null,
      reason: null,
    },
  ],
};

const matchingWorker = {
  id: 'worker-99',
  employeeId: 'EMP-099',
  firstName: 'Alice',
  lastName: 'Nasser',
  jobTitle: 'Staff Engineer',
};

type MutationHandle = { resolvedUrl: string; mutate: ReturnType<typeof vi.fn> };
let mutationHandles: MutationHandle[] = [];

function setupQueries() {
  useApiQueryMock.mockImplementation((queryKey: unknown, _url?: unknown, options?: { enabled?: boolean }) => {
    const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
    const secondPart = Array.isArray(queryKey) ? queryKey[1] : undefined;

    if (key === 'manager-attendance-exceptions') {
      return {
        data: {
          workDate: '2026-07-12',
          summary: { exceptions: 0, missingCheckout: 0, payrollReady: 0, totalEmployees: 0 },
          items: [],
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (key === 'manager-attendance-corrections') {
      return { data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() };
    }
    if (key === 'manager-leave-requests') {
      return { data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() };
    }
    if (key === 'manager-workflow-approvals') {
      return {
        data: { tenantId: 'tenant-1', chains: [workflowChain] },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (key === 'worker-picker-search') {
      const search = typeof secondPart === 'string' ? secondPart : '';
      if (options?.enabled === false || search.trim().length === 0) {
        return { data: undefined, isLoading: false, isError: false };
      }
      const results = matchingWorker.firstName.toLowerCase().includes(search.toLowerCase())
        || matchingWorker.lastName.toLowerCase().includes(search.toLowerCase())
        ? [matchingWorker]
        : [];
      return { data: results, isLoading: false, isError: false };
    }
    return { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  });
}

function setupMutations() {
  mutationHandles = [];
  useApiMutationMock.mockImplementation((url: unknown) => {
    const sampleVars = { id: 'sample-id', action: 'review', chainId: 'chain-1', stepId: 'step-1' };
    const resolvedUrl = typeof url === 'function'
      ? (url as (vars: typeof sampleVars) => string)(sampleVars)
      : String(url);
    const mutate = vi.fn();
    mutationHandles.push({ resolvedUrl, mutate });
    return { mutate, isPending: false };
  });
}

function findMutation(pathFragment: string): ReturnType<typeof vi.fn> {
  // Every render calls useApiMutation again, registering a fresh handle; the most
  // recently registered one is the mutate fn actually bound to the current DOM.
  for (let i = mutationHandles.length - 1; i >= 0; i -= 1) {
    if (mutationHandles[i].resolvedUrl.includes(pathFragment)) return mutationHandles[i].mutate;
  }
  throw new Error(`No mutation registered matching ${pathFragment}`);
}

function renderApprovals() {
  setupQueries();
  setupMutations();
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <ManagerApprovals />
    </MemoryRouter>,
  );
}

describe('ManagerApprovals workflow delegate picker', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    useApiMutationMock.mockReset();
  });

  it('disables Delegate until a worker is searched for and selected, then delegates the picked worker', async () => {
    const user = userEvent.setup();
    renderApprovals();

    const delegateButton = screen.getByRole('button', { name: 'Delegate' });
    expect(delegateButton).toBeDisabled();

    const searchInput = screen.getByPlaceholderText('Search by name or employee ID...');
    await user.click(searchInput);
    await user.type(searchInput, 'alice');

    const option = await screen.findByText('Alice Nasser');
    expect(option.closest('button')).toHaveTextContent('EMP-099');
    await user.click(option);

    expect(searchInput).toHaveValue('Alice Nasser');

    await waitFor(() => expect(delegateButton).toBeEnabled());
    await user.click(delegateButton);

    const delegateMutate = findMutation('/commands/delegate');
    expect(delegateMutate).toHaveBeenCalledWith(
      {
        chainId: 'chain-1',
        stepId: 'step-1',
        delegateToWorkerId: 'worker-99',
        reason: 'Delegated from manager workspace',
      },
      expect.anything(),
    );
  });

  it('lets the manager clear a selection and search again', async () => {
    const user = userEvent.setup();
    renderApprovals();

    const searchInput = screen.getByPlaceholderText('Search by name or employee ID...');
    await user.click(searchInput);
    await user.type(searchInput, 'alice');
    const option = await screen.findByText('Alice Nasser');
    await user.click(option);

    expect(searchInput).toHaveValue('Alice Nasser');

    await user.click(screen.getByRole('button', { name: /clear selected worker/i }));

    expect(searchInput).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Delegate' })).toBeDisabled();
  });
});
