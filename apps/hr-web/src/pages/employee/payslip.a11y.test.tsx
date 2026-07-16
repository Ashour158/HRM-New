import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { EmployeePayslip } from './payslip';

const useApiQueryMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
}));

const payslips = [
  {
    id: 'payslip-1',
    payPeriodStart: '2026-06-01',
    payPeriodEnd: '2026-06-30',
    payDate: '2026-07-01',
    grossPay: 8000,
    netPay: 6200,
    deductions: 1800,
    taxes: 900,
    currency: 'USD',
    lines: [{ id: 'line-1', description: 'Base salary', amount: 8000, currency: 'USD' }],
    pdfUrl: 'https://example.com/payslip-1.pdf',
  },
];

describe('EmployeePayslip accessibility', () => {
  it('renders without accessibility violations', async () => {
    useApiQueryMock.mockReturnValue({
      data: payslips,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<EmployeePayslip />);

    expect(screen.getByRole('heading', { name: /Payslips/i })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
