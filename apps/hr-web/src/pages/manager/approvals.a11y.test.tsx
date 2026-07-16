import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
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
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

const exceptionQueue = {
  workDate: '2026-07-13',
  summary: {
    exceptions: 1,
    missingCheckout: 0,
    payrollReady: 3,
    totalEmployees: 4,
  },
  items: [
    {
      code: 'LATE_ARRIVAL',
      description: 'Worker clocked in after the grace period.',
      severity: 'MEDIUM' as const,
      status: 'OPEN' as const,
      payrollImpactMinutes: 15,
      exceptionId: '00000000-0000-0000-0000-000000000901',
      workerId: '00000000-0000-0000-0000-000000000020',
      employeeId: 'E-020',
      workerName: 'Mina Soliman',
      workDate: '2026-07-13',
      firstCheckInAt: '2026-07-13T08:15:00.000Z',
      latestCheckOutAt: '2026-07-13T17:00:00.000Z',
      locationStatus: 'ON_SITE',
      policyEvidence: {
        schedule: { source: 'TENANT_DEFAULT', scheduleLabel: 'Standard shift' },
        trust: { minClockTrustScore: 80, lowTrustBlocksPayroll: false },
      },
    },
  ],
};

const corrections = [
  {
    id: '00000000-0000-0000-0000-000000000902',
    workerId: '00000000-0000-0000-0000-000000000020',
    workDate: '2026-07-12',
    correctionType: 'EDIT_CLOCK_EVENT' as const,
    requestedEventType: 'CLOCK_OUT' as const,
    requestedTimestamp: '2026-07-12T18:00:00.000Z',
    reason: 'Forgot to clock out after closing the store.',
    status: 'PENDING_MANAGER_REVIEW' as const,
    requestedAt: '2026-07-12T18:05:00.000Z',
  },
];

const leaveRequests = [
  {
    id: '00000000-0000-0000-0000-000000000903',
    workerId: '00000000-0000-0000-0000-000000000021',
    employeeName: 'Omar Farouk',
    type: 'ANNUAL',
    status: 'PENDING_APPROVAL',
    startDate: '2026-07-20',
    endDate: '2026-07-22',
    reason: 'Family trip',
  },
];

const workflowQueue = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  chains: [
    {
      id: '00000000-0000-0000-0000-000000000904',
      commandName: 'promoteWorker',
      aggregateType: 'WORKER',
      status: 'IN_PROGRESS' as const,
      createdAt: '2026-07-10T09:00:00.000Z',
      steps: [
        {
          id: '00000000-0000-0000-0000-000000000905',
          code: 'HR_REVIEW',
          label: 'HR review',
          order: 1,
          approverRole: 'HR_ADMIN',
          state: 'PENDING' as const,
        },
      ],
    },
  ],
};

describe('ManagerApprovals accessibility', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    useApiMutationMock.mockReset();
    useApiMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'manager-attendance-exceptions') return { data: exceptionQueue, isLoading: false, isError: false, error: null, refetch: vi.fn() };
      if (key === 'manager-attendance-corrections') return { data: corrections, isLoading: false, isError: false, error: null, refetch: vi.fn() };
      if (key === 'manager-leave-requests') return { data: leaveRequests, isLoading: false, isError: false, error: null, refetch: vi.fn() };
      if (key === 'manager-workflow-approvals') return { data: workflowQueue, isLoading: false, isError: false, error: null, refetch: vi.fn() };
      return { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    });
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <ManagerApprovals />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Team Attendance Approvals' })).toBeInTheDocument();
    expect(screen.getByText('Mina Soliman')).toBeInTheDocument();
    expect(screen.getByText('Omar Farouk')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
