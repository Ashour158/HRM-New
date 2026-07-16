import { describe, expect, it } from 'vitest';
import { PayrollCycleGovernanceService } from './payroll-cycle-governance.service.js';
import type { PayrollBankTransferRow, PayrollCyclePreview } from './payroll-cycle-calculation.service.js';

const preview = {
  id: '2026-05',
  name: 'May 2026 Payroll',
  year: 2026,
  month: 5,
  calendarDays: 31,
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  payDate: '2026-05-31',
  employeeCount: 2,
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
      workLocationCode: 'CAIRO_HQ',
      taxIdentifier: 'TAX-001',
      grossSalary: 10000,
      taxAmount: 1000,
      employeeInsuranceAmount: 500,
      employerInsuranceAmount: 1200,
      policyDeductionAmount: 100,
      netSalary: 8400,
      currency: 'EGP',
      attendanceSummary: {
        workedMinutes: 9000,
        payableMinutes: 9000,
        lateMinutes: 0,
        undertimeMinutes: 0,
        overtimeMinutes: 0,
        absentDays: 0,
        onDutyMinutes: 0,
        geofenceViolations: 0,
      },
      explainability: [],
    },
    {
      workerId: 'worker-2',
      employeeId: 'EMP-002',
      name: 'Ali Nader',
      email: 'ali@example.com',
      department: 'Operations',
      workLocationCode: 'CAIRO_HQ',
      policyAssignmentWarnings: ['No earning policy assigned'],
      grossSalary: 0,
      taxAmount: 0,
      employeeInsuranceAmount: 0,
      employerInsuranceAmount: 0,
      policyDeductionAmount: 0,
      netSalary: 0,
      currency: 'EGP',
      attendanceSummary: {
        workedMinutes: 0,
        payableMinutes: 0,
        lateMinutes: 0,
        undertimeMinutes: 0,
        overtimeMinutes: 0,
        absentDays: 0,
        onDutyMinutes: 0,
        geofenceViolations: 0,
        payrollBlockers: ['MISSING_CHECKOUT'],
      },
      explainability: [],
    },
  ],
} satisfies PayrollCyclePreview;

const bankRows: PayrollBankTransferRow[] = [
  {
    employeeId: 'EMP-001',
    workerId: 'worker-1',
    name: 'Mona Hassan',
    workEmail: 'mona@example.com',
    bankName: 'National Bank',
    accountHolderName: 'Mona Hassan',
    accountNumber: '123',
    iban: '',
    routingNumber: '',
    swiftCode: '',
    netSalary: 8400,
    currency: 'EGP',
    bankReady: true,
    readinessReason: 'READY',
  },
  {
    employeeId: 'EMP-002',
    workerId: 'worker-2',
    name: 'Ali Nader',
    workEmail: 'ali@example.com',
    bankName: '',
    accountHolderName: 'Ali Nader',
    accountNumber: '',
    iban: '',
    routingNumber: '',
    swiftCode: '',
    netSalary: 0,
    currency: 'EGP',
    bankReady: false,
    readinessReason: 'MISSING_ACCOUNT_IDENTIFIER',
  },
];

describe('PayrollCycleGovernanceService', () => {
  const service = new PayrollCycleGovernanceService();

  it('blocks close-to-pay when salary, bank, attendance, or net-pay readiness fails', () => {
    const readiness = service.evaluateCloseToPayReadiness({
      preview,
      bankRows,
      existingCycles: [],
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.blockingIssueCount).toBe(4);
    expect(readiness.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'MISSING_BANK_ACCOUNT',
      'MISSING_PAYROLL_COMPENSATION',
      'ATTENDANCE_BLOCKER',
      'ZERO_OR_NEGATIVE_NET_PAY',
    ]));
    expect(readiness.issues.find((issue) => issue.code === 'MISSING_BANK_ACCOUNT')).toEqual(expect.objectContaining({
      employeeId: 'EMP-002',
      blocking: true,
    }));
  });

  it('blocks duplicate payroll cycles for the same period and scope', () => {
    const readiness = service.evaluateCloseToPayReadiness({
      preview: { ...preview, rows: [preview.rows[0]], employeeCount: 1 },
      bankRows: [bankRows[0]],
      workLocationCode: 'CAIRO_HQ',
      existingCycles: [
        {
          payrollCycleId: 'cycle-123',
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
          workLocationCode: 'CAIRO_HQ',
          status: 'CLOSED',
        },
      ],
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.issues).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_PAYROLL_CYCLE',
      payrollCycleId: 'cycle-123',
      blocking: true,
    }));
  });

  it('passes readiness when cycle data is complete and no active duplicate exists', () => {
    const readiness = service.evaluateCloseToPayReadiness({
      preview: { ...preview, rows: [preview.rows[0]], employeeCount: 1 },
      bankRows: [bankRows[0]],
      existingCycles: [
        {
          payrollCycleId: 'cancelled-cycle',
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
          status: 'CANCELLED',
        },
      ],
    });

    expect(readiness.canClose).toBe(true);
    expect(readiness.blockingIssueCount).toBe(0);
  });

  it('uses setup-controlled payroll blocking rules and scopes them by worker', () => {
    const readiness = service.evaluateCloseToPayReadiness({
      preview,
      bankRows,
      existingCycles: [],
      setup: {
        payrollBlockingRules: [
          {
            code: 'BANK_WARNING_FOR_WORKER_2',
            label: 'Bank warning for worker 2',
            active: true,
            condition: 'MISSING_BANK_ACCOUNT',
            severity: 'WARNING',
            blocking: false,
            workerIds: ['worker-2'],
          },
          {
            code: 'NEGATIVE_NET_BLOCKER',
            label: 'Zero or negative net pay',
            active: true,
            condition: 'ZERO_OR_NEGATIVE_NET_PAY',
            severity: 'ERROR',
            blocking: true,
          },
        ],
      },
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.blockingIssueCount).toBe(1);
    expect(readiness.warningIssueCount).toBe(1);
    expect(readiness.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'BANK_WARNING_FOR_WORKER_2',
        employeeId: 'EMP-002',
        blocking: false,
        severity: 'WARNING',
      }),
      expect.objectContaining({
        code: 'NEGATIVE_NET_BLOCKER',
        employeeId: 'EMP-002',
        blocking: true,
        severity: 'ERROR',
      }),
    ]));
  });

  it('uses payroll v3 identity, policy assignment, and minimum net blockers', () => {
    const readiness = service.evaluateCloseToPayReadiness({
      preview,
      bankRows,
      existingCycles: [],
      setup: {
        payrollBlockingRules: [
          {
            code: 'TAX_ID_REQUIRED',
            label: 'Tax identifier required',
            active: true,
            condition: 'MISSING_TAX_IDENTIFIER',
            severity: 'ERROR',
            blocking: true,
          },
          {
            code: 'POLICY_ASSIGNMENT_REQUIRED',
            label: 'Policy assignment required',
            active: true,
            condition: 'MISSING_POLICY_ASSIGNMENT',
            severity: 'WARNING',
            blocking: false,
          },
          {
            code: 'MINIMUM_NET_PAY',
            label: 'Minimum net pay',
            active: true,
            condition: 'NET_BELOW_MINIMUM',
            severity: 'ERROR',
            blocking: true,
            minNetSalary: 1000,
            workerIds: ['worker-2'],
          },
        ],
      },
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.blockingIssueCount).toBe(2);
    expect(readiness.warningIssueCount).toBe(1);
    expect(readiness.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'TAX_ID_REQUIRED',
        employeeId: 'EMP-002',
        blocking: true,
      }),
      expect.objectContaining({
        code: 'POLICY_ASSIGNMENT_REQUIRED',
        employeeId: 'EMP-002',
        blocking: false,
      }),
      expect.objectContaining({
        code: 'MINIMUM_NET_PAY',
        employeeId: 'EMP-002',
        blocking: true,
      }),
    ]));
  });

  it('blocks payroll close when the applied country statutory runtime is missing or stale', () => {
    const readiness = service.evaluateCloseToPayReadiness({
      preview: { ...preview, rows: [preview.rows[0]], employeeCount: 1 },
      bankRows: [bankRows[0]],
      workLocationCode: 'CAIRO_HQ',
      existingCycles: [],
      setup: {
        countryPolicyRuntime: {
          countryCode: 'EG',
          packVersion: '2025.4',
          blocksPayrollIfStale: true,
          effectiveUntil: '2026-04-30',
        },
        statutoryPayrollPacks: [],
        payrollBlockingRules: [{
          code: 'COUNTRY_PACK_CURRENT',
          label: 'Country statutory pack current',
          active: true,
          condition: 'COUNTRY_POLICY_STALE',
          severity: 'ERROR',
          blocking: true,
          locationCodes: ['CAIRO_HQ'],
        }],
      },
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'COUNTRY_PACK_CURRENT',
        condition: 'COUNTRY_POLICY_STALE',
        blocking: true,
        message: expect.stringContaining('country statutory policy'),
      }),
    ]));
  });

  it('blocks enterprise close readiness when GL mapping and payment batch configuration are missing', () => {
    const readiness = service.evaluateCloseToPayReadiness({
      preview: { ...preview, rows: [preview.rows[0]], employeeCount: 1 },
      bankRows: [bankRows[0]],
      workLocationCode: 'CAIRO_HQ',
      existingCycles: [],
      setup: {
        locations: [{ code: 'CAIRO_HQ', countryCode: 'EG', currency: 'EGP' }],
        statutoryPayrollPacks: [{
          code: 'EG_STAT',
          label: 'Egypt statutory payroll',
          active: true,
          countryCode: 'EG',
          locationCodes: ['CAIRO_HQ'],
          calculationPolicy: {
            taxRatePercent: 10,
            employeeInsuranceRatePercent: 5,
          },
        }],
      },
      closeEvidence: {
        requireEnterpriseEvidence: true,
      },
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'MISSING_GL_MAPPING',
        blocking: true,
        message: expect.stringContaining('GL account mapping'),
      }),
      expect.objectContaining({
        code: 'MISSING_PAYMENT_BATCH_CONFIG',
        blocking: true,
        message: expect.stringContaining('bank file format'),
      }),
    ]));
  });

  it('blocks enterprise close readiness when persisted GL, payment, payslip, or payroll exception evidence is not ready', () => {
    const readiness = service.evaluateCloseToPayReadiness({
      preview: { ...preview, rows: [preview.rows[0]], employeeCount: 1 },
      bankRows: [bankRows[0]],
      workLocationCode: 'CAIRO_HQ',
      existingCycles: [],
      setup: {
        locations: [{ code: 'CAIRO_HQ', countryCode: 'EG', currency: 'EGP' }],
        statutoryPayrollPacks: [{
          code: 'EG_STAT',
          label: 'Egypt statutory payroll',
          active: true,
          countryCode: 'EG',
          locationCodes: ['CAIRO_HQ'],
          bankFileFormats: ['CBE_EGYPT_CSV'],
          calculationPolicy: {
            taxRatePercent: 10,
            employeeInsuranceRatePercent: 5,
          },
          glAccountMapping: {
            salaryExpenseAccount: '6100',
            employerInsuranceExpenseAccount: '6110',
            taxPayableAccount: '2150',
            insurancePayableAccount: '2160',
            deductionPayableAccount: '2250',
            bankClearingAccount: '1050',
          },
        }],
      },
      closeEvidence: {
        requireEnterpriseEvidence: true,
        expectedPayslipWorkerIds: ['worker-1'],
        glPosting: {
          status: 'DRAFT',
          totalDebits: 100,
          totalCredits: 90,
          lineCount: 2,
        },
        paymentBatch: {
          status: 'RECONCILIATION_EXCEPTION',
          readyCount: 1,
          blockedCount: 0,
          totalNet: 8400,
          exceptionCount: 1,
        },
        payslipArtifacts: [{
          workerId: 'worker-2',
          employeeId: 'EMP-002',
          status: 'GENERATED',
          contentHash: 'hash',
          htmlReady: true,
        }],
      },
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'GL_POSTING_UNBALANCED', blocking: true }),
      expect.objectContaining({ code: 'UNRESOLVED_PAYROLL_EXCEPTION', blocking: true }),
      expect.objectContaining({ code: 'MISSING_PAYSLIP_ARTIFACT', workerId: 'worker-1', blocking: true }),
    ]));
  });

  const enterpriseGlSetup = {
    locations: [{ code: 'CAIRO_HQ', countryCode: 'EG', currency: 'EGP' }],
    statutoryPayrollPacks: [{
      code: 'EG_STAT',
      label: 'Egypt statutory payroll',
      active: true,
      countryCode: 'EG',
      locationCodes: ['CAIRO_HQ'],
      bankFileFormats: ['CBE_EGYPT_CSV'],
      calculationPolicy: {
        taxRatePercent: 10,
        employeeInsuranceRatePercent: 5,
      },
      glAccountMapping: {
        salaryExpenseAccount: '6100',
        employerInsuranceExpenseAccount: '6110',
        taxPayableAccount: '2150',
        insurancePayableAccount: '2160',
        deductionPayableAccount: '2250',
        bankClearingAccount: '1050',
      },
    }],
  };

  function readinessForGlPosting(totalDebits: number, totalCredits: number) {
    return service.evaluateCloseToPayReadiness({
      preview: { ...preview, rows: [preview.rows[0]], employeeCount: 1 },
      bankRows: [bankRows[0]],
      workLocationCode: 'CAIRO_HQ',
      existingCycles: [],
      setup: enterpriseGlSetup,
      closeEvidence: {
        requireEnterpriseEvidence: true,
        expectedPayslipWorkerIds: ['worker-1'],
        glPosting: { status: 'POSTED', totalDebits, totalCredits, lineCount: 2 },
        paymentBatch: {
          status: 'READY',
          readyCount: 1,
          blockedCount: 0,
          totalNet: 8400,
          exceptionCount: 0,
        },
        payslipArtifacts: [{
          workerId: 'worker-1',
          employeeId: 'EMP-001',
          status: 'GENERATED',
          contentHash: 'hash',
          htmlReady: true,
        }],
      },
    });
  }

  it('flags a genuine one-cent GL debit/credit mismatch as unbalanced instead of tolerating it as a rounding epsilon', () => {
    // Previously: Math.abs(100.10 - 100.09) <= 0.01 evaluated to true, so a
    // real one-cent GL imbalance was incorrectly reported as "balanced".
    const readiness = readinessForGlPosting(8400.10, 8400.09);
    expect(readiness.issues).toContainEqual(expect.objectContaining({ code: 'GL_POSTING_UNBALANCED', blocking: true }));
  });

  it('still treats harmless binary floating-point noise as balanced after rounding to cents', () => {
    // 8400 + 0.1 + 0.2 in IEEE 754 double precision is 8400.300000000001,
    // not exactly 8400.3 -- roundMoney must absorb that noise so two totals
    // that are equal in cents, but computed via different summation paths,
    // still compare equal instead of failing a strict raw `===`.
    const totalDebits = 8400 + 0.1 + 0.2;
    const totalCredits = 8400.3;
    expect(totalDebits).not.toBe(totalCredits); // sanity: raw float noise is real
    const readiness = readinessForGlPosting(totalDebits, totalCredits);
    expect(readiness.issues).not.toContainEqual(expect.objectContaining({ code: 'GL_POSTING_UNBALANCED' }));
  });

  it('evaluates close readiness for a large tenant payroll preview without dropping worker-level blockers', () => {
    const rowCount = 1_000;
    const largeRows = Array.from({ length: rowCount }, (_, index) => ({
      ...preview.rows[0],
      workerId: `worker-${index + 1}`,
      employeeId: `EMP-${String(index + 1).padStart(4, '0')}`,
      netSalary: index % 100 === 0 ? 0 : 8400,
      grossSalary: index % 100 === 0 ? 0 : 10000,
    }));
    const largeBankRows = largeRows.map<PayrollBankTransferRow>((row) => ({
      ...bankRows[0],
      workerId: row.workerId,
      employeeId: row.employeeId,
      netSalary: row.netSalary ?? 0,
      bankReady: true,
    }));

    const readiness = service.evaluateCloseToPayReadiness({
      preview: {
        ...preview,
        employeeCount: rowCount,
        rows: largeRows,
      },
      bankRows: largeBankRows,
      existingCycles: [],
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.issues.filter((issue) => issue.code === 'MISSING_PAYROLL_COMPENSATION')).toHaveLength(10);
    expect(readiness.issues.filter((issue) => issue.code === 'ZERO_OR_NEGATIVE_NET_PAY')).toHaveLength(10);
  });
});
