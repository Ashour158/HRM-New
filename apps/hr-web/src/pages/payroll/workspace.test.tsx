import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayrollWorkspace } from './workspace';

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

describe('PayrollWorkspace', () => {
  beforeEach(() => {
    addNotificationMock.mockReset();
    useApiQueryMock.mockReset();
    useApiMutationMock.mockReset();
    useApiMutationMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useApiQueryMock.mockImplementation((queryKey: unknown, url: string) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'payroll-workspace-preview') return { data: cyclePreview, isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'payroll-workspace-payment-batch') return { data: { ready: true, readyCount: 2, blockedCount: 0, totalNet: 15000, currency: 'EGP' }, isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'payroll-workspace-export-jobs') return { data: [], isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'payroll-workspace-payslips') return { data: [{ workerId: cyclePreview.rows[0].workerId, employeeId: 'E-100', netPay: 8000, grossPay: 9000, currency: 'EGP', status: 'PUBLISHED' }], isLoading: false, isError: false, refetch: vi.fn() };
      throw new Error(`Unexpected query ${String(key)} ${url}`);
    });
  });

  it('renders payroll run explainability, payslips, and uses real payroll API paths', async () => {
    render(<PayrollWorkspace />);

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
      expect.any(Array),
      expect.any(Object),
    );
  });
});
