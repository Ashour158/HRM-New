import { describe, expect, it } from 'vitest';
import { PayrollInputOrchestrationService } from './payroll-input-orchestration.service.js';
import type { PayrollBankTransferRow, PayrollCyclePreview, PayrollCycleRow, PayrollPayslip } from './payroll-cycle-calculation.service.js';

const row: PayrollCycleRow = {
  workerId: 'worker-1',
  employeeId: 'EMP-001',
  name: 'Mona Hassan',
  email: 'mona@example.com',
  department: 'Finance',
  employmentType: 'FULL_TIME',
  salaryBasis: 'MONTHLY',
  workLocationCode: 'CAIRO_HQ',
  baseGrossSalary: 10000,
  earningAmount: 1500,
  taxableEarningAmount: 1200,
  nonTaxableEarningAmount: 300,
  grossSalary: 11500,
  taxAmount: 1120,
  employeeInsuranceAmount: 560,
  employerInsuranceAmount: 1344,
  policyDeductionAmount: 160,
  netSalary: 9660,
  currency: 'EGP',
  attendanceSummary: {
    workedMinutes: 9000,
    payableMinutes: 9000,
    lateMinutes: 30,
    undertimeMinutes: 0,
    overtimeMinutes: 60,
    absentDays: 0,
    onDutyMinutes: 0,
    geofenceViolations: 0,
  },
  explainability: [],
  taxIdentifier: 'TAX-001',
  insuranceIdentifier: 'SI-001',
};

describe('PayrollInputOrchestrationService', () => {
  const service = new PayrollInputOrchestrationService();

  it('turns a calculated payroll row into governed payroll input drafts', () => {
    const drafts = service.buildInputDrafts(row, { payrollCycleId: 'cycle-1' });

    expect(drafts.map((draft) => draft.inputType)).toEqual([
      'BASE_GROSS_PAY',
      'EARNING_TOTAL',
      'TAXABLE_EARNINGS',
      'NON_TAXABLE_EARNINGS',
      'EMPLOYEE_TAX',
      'EMPLOYEE_INSURANCE',
      'EMPLOYER_INSURANCE',
      'POLICY_DEDUCTION',
      'ATTENDANCE_PAYABLE_HOURS',
      'ATTENDANCE_OVERTIME_HOURS',
      'NET_PAY',
    ]);
    expect(drafts.find((draft) => draft.inputType === 'BASE_GROSS_PAY')).toEqual(expect.objectContaining({
      workerId: 'worker-1',
      payrollCycleId: 'cycle-1',
      amount: 10000,
      currency: 'EGP',
      description: 'EMP-001 Mona Hassan base gross pay',
    }));
    expect(drafts.find((draft) => draft.inputType === 'ATTENDANCE_PAYABLE_HOURS')?.amount).toBe(150);
  });

  it('builds payment batch readiness from bank rows and totals', () => {
    const preview = {
      id: '2026-05',
      name: 'May 2026 Payroll',
      year: 2026,
      month: 5,
      calendarDays: 31,
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      payDate: '2026-05-31',
      employeeCount: 1,
      totalGross: 11500,
      totalTax: 1120,
      totalEmployeeInsurance: 560,
      totalEmployerInsurance: 1344,
      totalPolicyDeductions: 160,
      totalNet: 9660,
      currency: 'EGP',
      rows: [row],
    } satisfies PayrollCyclePreview;
    const bankRows: PayrollBankTransferRow[] = [{
      employeeId: 'EMP-001',
      workerId: 'worker-1',
      name: 'Mona Hassan',
      workEmail: 'mona@example.com',
      bankName: 'National Bank',
      accountHolderName: 'Mona Hassan',
      accountNumber: '123456789',
      iban: '',
      routingNumber: '',
      swiftCode: '',
      netSalary: 9660,
      currency: 'EGP',
      bankReady: true,
      readinessReason: 'READY',
    }];

    expect(service.buildPaymentBatch(preview, bankRows)).toEqual(expect.objectContaining({
      batchId: 'PAYMENT-2026-05',
      ready: true,
      readyCount: 1,
      blockedCount: 0,
      totalNet: 9660,
      currency: 'EGP',
    }));
  });

  it('renders an escaped payslip HTML artifact', () => {
    const payslip: PayrollPayslip = {
      id: 'cycle-1:worker-1',
      workerId: 'worker-1',
      employeeId: 'EMP-001',
      employeeName: '<Mona>',
      payPeriodStart: '2026-05-01',
      payPeriodEnd: '2026-05-31',
      payDate: '2026-05-31',
      grossPay: 11500,
      netPay: 9660,
      deductions: 1840,
      taxes: 1120,
      currency: 'EGP',
      lines: [
        { id: 'line-1', workerId: 'worker-1', lineType: 'GROSS', description: 'Base <gross>', amount: 10000, currency: 'EGP', explanation: 'internal gross formula' },
      ],
    };

    const html = service.renderPayslipHtml(payslip);

    expect(html).toContain('&lt;Mona&gt;');
    expect(html).toContain('EMP-001');
    expect(html).toContain('Base &lt;gross&gt;');
    expect(html).toContain('9660');
    expect(html).not.toContain('internal gross formula');
    expect(html).not.toContain('<th>Explanation</th>');
  });
});
