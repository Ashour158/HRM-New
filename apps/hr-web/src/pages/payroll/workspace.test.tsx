import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayrollWorkspace } from './workspace';

function renderWorkspace() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PayrollWorkspace />
    </QueryClientProvider>,
  );
}

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();
const addNotificationMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

const cyclePreview = {
  id: '2026-06',
  name: 'June 2026 payroll',
  year: 2026,
  month: 6,
  employeeCount: 2,
  totalGross: 17000,
  totalTax: 1400,
  totalEmployeeInsurance: 600,
  totalNet: 15000,
  currency: 'EGP',
  readiness: { canClose: true, blockingIssueCount: 0, warningIssueCount: 1, issues: [] },
  rows: [
    {
      workerId: '00000000-0000-0000-0000-000000000801',
      employeeId: 'E-100',
      name: 'Nour Ali',
      grossSalary: 9000,
      taxAmount: 700,
      netSalary: 8000,
      currency: 'EGP',
      explainability: [
        {
          code: 'BASE_SALARY',
          label: 'Basic salary',
          amount: 9000,
          formula: 'baseGrossSalary',
          glAccount: '5000-BASE',
          taxable: true,
          insurable: true,
          source: 'COMPENSATION',
        },
      ],
    },
  ],
};

/** Mutable box the test can update between renders to simulate successive status-poll ticks. */
let jobStatusData: Record<string, unknown> | undefined;

function installQueryMock() {
  useApiQueryMock.mockImplementation((queryKey: unknown, url: string) => {
    const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
    if (key === 'payroll-workspace-preview') return { data: cyclePreview, isLoading: false, isError: false, refetch: vi.fn() };
    if (key === 'payroll-workspace-payment-batch') return { data: { ready: true, readyCount: 2, blockedCount: 0, totalNet: 15000, currency: 'EGP' }, isLoading: false, isError: false, refetch: vi.fn() };
    if (key === 'payroll-workspace-export-jobs') return { data: [], isLoading: false, isError: false, refetch: vi.fn() };
    if (key === 'payroll-workspace-payslips') return { data: [{ workerId: cyclePreview.rows[0].workerId, employeeId: 'E-100', netPay: 8000, grossPay: 9000, currency: 'EGP', status: 'PUBLISHED' }], isLoading: false, isError: false, refetch: vi.fn() };
    if (key === 'payroll-close-job-status') return { data: jobStatusData, isLoading: false, isError: false, refetch: vi.fn() };
    // NextActions (embedded via the page shell) queries the me-inbox feed.
    if (key === 'me-inbox') return { data: { items: [] }, isLoading: false, isError: false, refetch: vi.fn() };
    throw new Error(`Unexpected query ${String(key)} ${url}`);
  });
}

describe('PayrollWorkspace', () => {
  beforeEach(() => {
    addNotificationMock.mockReset();
    useApiQueryMock.mockReset();
    useApiMutationMock.mockReset();
    jobStatusData = undefined;
    useApiMutationMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    installQueryMock();
  });

  it('renders payroll run explainability, payslips, and uses real payroll API paths', async () => {
    renderWorkspace();

    expect(screen.getByRole('heading', { name: 'Payroll Workspace' })).toBeInTheDocument();
    expect(screen.getByText('June 2026 payroll')).toBeInTheDocument();
    expect(screen.getByText('Basic salary')).toBeInTheDocument();
    expect(screen.getByText('5000-BASE')).toBeInTheDocument();
    expect(screen.getByText('Payslip drill-down')).toBeInTheDocument();
    expect(useApiQueryMock).toHaveBeenCalledWith(expect.arrayContaining(['payroll-workspace-preview']), expect.stringContaining('/payroll/monthly-cycle-preview'), expect.any(Object));
    expect(useApiQueryMock).toHaveBeenCalledWith(expect.arrayContaining(['payroll-workspace-payment-batch']), expect.stringContaining('/payroll/payment-batch-preview'), expect.any(Object));

    await userEvent.click(screen.getByRole('button', { name: /close to pay/i }));
    expect(useApiMutationMock).toHaveBeenCalledWith(
      '/payroll/monthly-cycle/close-to-pay',
      'post',
      undefined,
      expect.any(Object),
    );
  });

  it('starts a background close-to-pay job and polls its status instead of blocking on one request', async () => {
    let closeOptions: { onSuccess?: (result: unknown) => void } = {};
    const mutateAsync = vi.fn(async () => {
      jobStatusData = { jobId: 'JOB-1', status: 'RUNNING', totalEmployees: 2, processedEmployees: 0, totalBatches: 1, currentBatch: 0 };
      closeOptions.onSuccess?.({ jobId: 'JOB-1', status: 'RUNNING', employeeCount: 2, totalBatches: 1, batchSize: 50 });
      return { jobId: 'JOB-1', status: 'RUNNING', employeeCount: 2, totalBatches: 1, batchSize: 50 };
    });
    useApiMutationMock.mockImplementation((url: string, _method: string, _invalidateKeys: unknown, options: { onSuccess?: (result: unknown) => void }) => {
      if (url === '/payroll/monthly-cycle/close-to-pay') {
        closeOptions = options;
        return { mutateAsync, isPending: false };
      }
      return { mutateAsync: vi.fn(), isPending: false };
    });

    const { rerender } = renderWorkspace();
    await userEvent.click(screen.getByRole('button', { name: /close to pay/i }));

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ closeCycle: true }));
    await waitFor(() => expect(screen.getByText(/close-to-pay run in progress/i)).toBeInTheDocument());
    expect(screen.getByText(/0 of 2 employees/i)).toBeInTheDocument();
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payroll close started' }));

    // The close-to-pay button must not be re-clickable while the job is running - there is no
    // second request to send until this one finishes.
    expect(screen.getByRole('button', { name: /closing to pay/i })).toBeDisabled();

    // Simulate the next poll tick reporting completion.
    jobStatusData = {
      jobId: 'JOB-1',
      status: 'SUCCEEDED',
      totalEmployees: 2,
      processedEmployees: 2,
      totalBatches: 1,
      currentBatch: 1,
      errors: [],
      result: { payrollCycleId: 'cycle-1', status: 'CLOSED', totalNet: 15000, currency: 'EGP' },
    };
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <PayrollWorkspace />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText(/close-to-pay run completed/i)).toBeInTheDocument());
    expect(screen.getByText(/2 of 2 employees/i)).toBeInTheDocument();
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payroll close completed' }));
  });

  it('surfaces per-employee errors and a failure notification without hiding job progress', async () => {
    let closeOptions: { onSuccess?: (result: unknown) => void } = {};
    const mutateAsync = vi.fn(async () => {
      jobStatusData = { jobId: 'JOB-2', status: 'RUNNING', totalEmployees: 3, processedEmployees: 0, totalBatches: 1, currentBatch: 0 };
      closeOptions.onSuccess?.({ jobId: 'JOB-2', status: 'RUNNING', employeeCount: 3, totalBatches: 1, batchSize: 50 });
      return { jobId: 'JOB-2' };
    });
    useApiMutationMock.mockImplementation((url: string, _method: string, _invalidateKeys: unknown, options: { onSuccess?: (result: unknown) => void }) => {
      if (url === '/payroll/monthly-cycle/close-to-pay') {
        closeOptions = options;
        return { mutateAsync, isPending: false };
      }
      return { mutateAsync: vi.fn(), isPending: false };
    });

    const { rerender } = renderWorkspace();
    await userEvent.click(screen.getByRole('button', { name: /close to pay/i }));
    await waitFor(() => expect(screen.getByText(/close-to-pay run in progress/i)).toBeInTheDocument());

    jobStatusData = {
      jobId: 'JOB-2',
      status: 'SUCCEEDED',
      totalEmployees: 3,
      processedEmployees: 3,
      totalBatches: 1,
      currentBatch: 1,
      errors: [{ workerId: 'w-1', employeeId: 'E-1', stage: 'CALCULATION', message: 'boom' }],
      result: { payrollCycleId: 'cycle-2', status: 'REVIEW', totalNet: 5000, currency: 'EGP' },
    };
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <PayrollWorkspace />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText(/1 employee had errors/i)).toBeInTheDocument());
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payroll close completed', type: 'warning' }));
  });
});
