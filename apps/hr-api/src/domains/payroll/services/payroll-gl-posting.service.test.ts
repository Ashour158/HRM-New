import { describe, expect, it } from 'vitest';
import { PayrollGlPostingService } from './payroll-gl-posting.service.js';
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
  totalEmployeeInsurance: 700,
  totalEmployerInsurance: 1200,
  totalPolicyDeductions: 300,
  totalNet: 8000,
  currency: 'EGP',
  rows: [],
};

describe('PayrollGlPostingService', () => {
  const service = new PayrollGlPostingService();

  it('builds a balanced payroll journal from cycle totals', () => {
    const posting = service.buildPosting({
      tenantId: 'tenant-1',
      payrollCycleId: 'cycle-1',
      preview,
      createdBy: 'actor-1',
    });

    expect(posting.status).toBe('DRAFT');
    expect(posting.totalDebits).toBe(posting.totalCredits);
    expect(posting.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountCode: '6000', debit: 10000, credit: 0 }),
      expect.objectContaining({ accountCode: '6010', debit: 1200, credit: 0 }),
      expect.objectContaining({ accountCode: '2100', debit: 0, credit: 1000 }),
      expect.objectContaining({ accountCode: '2110', debit: 0, credit: 1900 }),
      expect.objectContaining({ accountCode: '2200', debit: 0, credit: 300 }),
      expect.objectContaining({ accountCode: '1000', debit: 0, credit: 8000 }),
    ]));
  });
});
