import { describe, expect, it } from 'vitest';
import { PayrollApprovedInputProjectionService } from './payroll-approved-input-projection.service.js';
import type { PayrollCyclePreview } from './payroll-cycle-calculation.service.js';

const preview: PayrollCyclePreview = {
  id: '2026-05',
  name: 'May 2026 Payroll',
  year: 2026,
  month: 5,
  calendarDays: 31,
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  payDate: '2026-05-31',
  employeeCount: 1,
  totalGross: 10000,
  totalTax: 1000,
  totalEmployeeInsurance: 500,
  totalEmployerInsurance: 1200,
  totalPolicyDeductions: 100,
  totalNet: 8400,
  currency: 'EGP',
  rows: [
    {
      workerId: 'worker-1',
      employeeId: 'EMP-001',
      name: 'Mona Hassan',
      email: 'mona@example.com',
      department: 'Finance',
      employmentType: 'FULL_TIME',
      salaryBasis: 'MONTHLY',
      workLocationCode: 'CAIRO_HQ',
      baseGrossSalary: 10000,
      earningAmount: 0,
      taxableEarningAmount: 0,
      nonTaxableEarningAmount: 0,
      grossSalary: 10000,
      taxAmount: 1000,
      employeeInsuranceAmount: 500,
      employerInsuranceAmount: 1200,
      policyDeductionAmount: 100,
      netSalary: 8400,
      currency: 'EGP',
      explainability: [
        {
          code: 'GROSS',
          label: 'Base gross salary',
          amount: 10000,
          source: 'COMPENSATION',
          formula: 'Employee compensation gross salary',
        },
        {
          code: 'TAX',
          label: 'Payroll tax',
          amount: 1000,
          source: 'POLICY',
          formula: 'taxable base 10000 * 10%',
        },
      ],
    },
  ],
};

describe('PayrollApprovedInputProjectionService', () => {
  const service = new PayrollApprovedInputProjectionService();

  it('uses approved payroll inputs as the source of truth for calculation rows and totals', () => {
    const projected = service.applyApprovedInputs(preview, [
      {
        workerId: 'worker-1',
        inputType: 'MASS_UPDATE_GROSS_PAY',
        amount: 12000,
        currency: 'EGP',
        status: 'APPROVED',
      },
      {
        workerId: 'worker-1',
        inputType: 'MASS_UPDATE_TAX_OVERRIDE',
        amount: 900,
        currency: 'EGP',
        status: 'APPROVED',
      },
      {
        workerId: 'worker-1',
        inputType: 'MASS_UPDATE_INSURANCE_OVERRIDE',
        amount: 450,
        currency: 'EGP',
        status: 'APPROVED',
      },
      {
        workerId: 'worker-1',
        inputType: 'MASS_UPDATE_DEDUCTION_LATE_PER_MINUTE',
        amount: 150,
        currency: 'EGP',
        status: 'APPROVED',
      },
      {
        workerId: 'worker-1',
        inputType: 'MASS_UPDATE_DEDUCTION_IGNORED',
        amount: 999,
        currency: 'EGP',
        status: 'REJECTED',
      },
    ]);

    const [row] = projected.rows;
    expect(row.baseGrossSalary).toBe(12000);
    expect(row.grossSalary).toBe(12000);
    expect(row.taxAmount).toBe(900);
    expect(row.employeeInsuranceAmount).toBe(450);
    expect(row.policyDeductionAmount).toBe(250);
    expect(row.netSalary).toBe(10400);
    expect(projected.totalGross).toBe(12000);
    expect(projected.totalTax).toBe(900);
    expect(projected.totalEmployeeInsurance).toBe(450);
    expect(projected.totalPolicyDeductions).toBe(250);
    expect(projected.totalNet).toBe(10400);
    expect(row.explainability.map((line) => line.code)).toEqual(expect.arrayContaining([
      'APPROVED_GROSS_PAY_INPUT',
      'APPROVED_TAX_OVERRIDE',
      'APPROVED_INSURANCE_OVERRIDE',
      'MASS_UPDATE_DEDUCTION_LATE_PER_MINUTE',
    ]));
  });
});
