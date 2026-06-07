import { describe, expect, it } from 'vitest';
import {
  PayrollCycleCalculationService,
  type PayrollCycleEmployeeInput,
} from './payroll-cycle-calculation.service.js';
import type { HcmSetupConfig } from '../../hcm-setup/hcm-setup.types.js';

const setup = {
  payrollCalculationPolicy: {
    taxRatePercent: 10,
    employeeInsuranceRatePercent: 5,
    employerInsuranceRatePercent: 12,
  },
  deductionPolicies: [
    {
      code: 'LATE_PER_MINUTE',
      label: 'Late arrival deduction',
      active: true,
      type: 'PER_MINUTE',
      attendanceEvent: 'LATE',
      amount: 2,
    },
    {
      code: 'MONTHLY_FIXED',
      label: 'Monthly fixed deduction',
      active: true,
      type: 'FIXED_AMOUNT',
      amount: 100,
    },
  ],
} as HcmSetupConfig;

const employee: PayrollCycleEmployeeInput = {
  workerId: 'worker-1',
  employeeId: 'EMP-001',
  name: 'Mona Hassan',
  email: 'mona@example.com',
  department: 'Finance',
  workLocationCode: 'CAIRO_HQ',
  grossSalary: 10000,
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
};

describe('PayrollCycleCalculationService', () => {
  const service = new PayrollCycleCalculationService();

  it('builds a calendar-month payroll cycle including leap-year days', () => {
    const cycle = service.buildMonthlyCycle({
      year: 2024,
      month: 2,
      employees: [employee],
      setup,
    });

    expect(cycle.calendarDays).toBe(29);
    expect(cycle.periodStart).toBe('2024-02-01');
    expect(cycle.periodEnd).toBe('2024-02-29');
    expect(cycle.rows).toHaveLength(1);
  });

  it('calculates gross-to-net with statutory and low-code deduction policies', () => {
    const [row] = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [employee],
      setup,
    }).rows;

    expect(row.taxAmount).toBe(1000);
    expect(row.employeeInsuranceAmount).toBe(500);
    expect(row.policyDeductionAmount).toBe(160);
    expect(row.netSalary).toBe(8340);
    expect(row.explainability.map((item) => item.code)).toEqual(
      expect.arrayContaining(['TAX', 'EMPLOYEE_INSURANCE', 'LATE_PER_MINUTE', 'MONTHLY_FIXED']),
    );
  });

  it('masks salary data unless the actor owns the row or has payroll visibility', () => {
    const row = service.buildMonthlyCycle({ year: 2026, month: 5, employees: [employee], setup }).rows[0];

    expect(service.maskRowForActor(row, { roles: ['EMPLOYEE'], workerId: 'someone-else' }).netSalary).toBeNull();
    expect(service.maskRowForActor(row, { roles: ['EMPLOYEE'], workerId: 'worker-1' }).netSalary).toBe(8340);
    expect(service.maskRowForActor(row, { roles: ['PAYROLL_ADMIN'] }).grossSalary).toBe(10000);
  });

  it('summarizes locked attendance ledger snapshots as payroll source of truth', () => {
    const summary = service.summarizeLockedAttendanceSnapshots([
      {
        status: 'ABSENT',
        workedMinutes: 0,
        payableMinutes: 0,
        deductionMinutes: 480,
        overtimeMinutes: 0,
        lateMinutes: 0,
        undertimeMinutes: 0,
        locationStatus: 'NO_GEOLOCATION',
      },
      {
        status: 'GEOFENCE_VIOLATION',
        workedMinutes: 420,
        payableMinutes: 420,
        deductionMinutes: 60,
        overtimeMinutes: 30,
        lateMinutes: 15,
        undertimeMinutes: 45,
        locationStatus: 'OUTSIDE_GEOFENCE',
      },
    ]);

    expect(summary).toEqual({
      workedMinutes: 420,
      payableMinutes: 420,
      lateMinutes: 15,
      undertimeMinutes: 45,
      overtimeMinutes: 30,
      absentDays: 1,
      onDutyMinutes: 0,
      geofenceViolations: 1,
    });
  });

  it('carries governed bank account data into bank transfer rows', () => {
    const [row] = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [
        {
          ...employee,
          bankAccount: {
            bankName: 'National Bank',
            accountHolderName: 'Mona Hassan',
            accountNumber: '1234567890',
            iban: 'EG380019000500000000263180002',
            routingNumber: 'NBEGEGCX',
          },
        },
      ],
      setup,
    }).rows;

    const [bankRow] = service.buildBankTransferRows([row]);

    expect(bankRow).toEqual(expect.objectContaining({
      employeeId: 'EMP-001',
      name: 'Mona Hassan',
      bankName: 'National Bank',
      accountHolderName: 'Mona Hassan',
      accountNumber: '1234567890',
      iban: 'EG380019000500000000263180002',
      routingNumber: 'NBEGEGCX',
      netSalary: 8340,
      currency: 'EGP',
      bankReady: true,
      readinessReason: 'READY',
    }));
  });

  it('marks bank transfer rows incomplete when account details are missing', () => {
    const [row] = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [{ ...employee, bankAccount: { bankName: 'National Bank' } }],
      setup,
    }).rows;

    const [bankRow] = service.buildBankTransferRows([row]);

    expect(bankRow.bankReady).toBe(false);
    expect(bankRow.readinessReason).toBe('MISSING_ACCOUNT_IDENTIFIER');
  });

  it('expands a payroll row into persisted result-line drafts with explainability', () => {
    const [row] = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [employee],
      setup,
    }).rows;

    const drafts = service.buildResultLineDrafts(row, {
      payrollCycleId: 'cycle-1',
      calculationRunId: 'run-1',
    });

    expect(drafts.map((draft) => draft.lineType)).toEqual([
      'GROSS',
      'TAX',
      'EMPLOYEE_INSURANCE',
      'EMPLOYER_INSURANCE',
      'LATE_PER_MINUTE',
      'MONTHLY_FIXED',
      'NET_PAY',
    ]);
    expect(drafts.find((draft) => draft.lineType === 'NET_PAY')).toEqual(expect.objectContaining({
      amount: 8340,
      description: 'Net pay',
      calculationStep: 'NET',
    }));
    expect(drafts.every((draft) => draft.inputSnapshotHash?.length === 64)).toBe(true);
  });

  it('aggregates employee payslips from payroll cycle result lines', () => {
    const [row] = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [employee],
      setup,
    }).rows;
    const resultLines = service.buildResultLineDrafts(row, {
      payrollCycleId: 'cycle-1',
      calculationRunId: 'run-1',
    }).map((draft, index) => ({
      id: `line-${index}`,
      workerId: draft.workerId,
      lineType: draft.lineType,
      description: draft.description,
      amount: draft.amount,
      currency: draft.currency,
      explanation: draft.explanation,
      status: 'LOCKED',
    }));

    const [payslip] = service.buildPayslipsFromResultLines({
      payrollCycle: {
        id: 'cycle-1',
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        payDate: '2026-05-31',
      },
      employees: [employee],
      resultLines,
    });

    expect(payslip).toEqual(expect.objectContaining({
      id: 'cycle-1:worker-1',
      workerId: 'worker-1',
      payPeriodStart: '2026-05-01',
      payPeriodEnd: '2026-05-31',
      payDate: '2026-05-31',
      grossPay: 10000,
      taxes: 1000,
      deductions: 660,
      netPay: 8340,
      currency: 'EGP',
    }));
    expect(payslip.lines.map((line) => line.lineType)).toContain('NET_PAY');
  });

  it('calculates progressive tax brackets instead of flat tax when configured', () => {
    const bracketSetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 5,
        taxMode: 'PROGRESSIVE_BRACKETS',
        taxBrackets: [
          { code: 'TAX_FREE', label: 'Tax free allowance', thresholdFrom: 0, thresholdTo: 10000, ratePercent: 0 },
          { code: 'BASIC_TAX', label: 'Basic tax', thresholdFrom: 10000, thresholdTo: 20000, ratePercent: 10 },
          { code: 'HIGH_TAX', label: 'High tax', thresholdFrom: 20000, ratePercent: 20 },
        ],
        employeeInsuranceRatePercent: 0,
      },
      deductionPolicies: [],
    } as HcmSetupConfig;

    const [row] = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [{ ...employee, grossSalary: 30000 }],
      setup: bracketSetup,
    }).rows;

    expect(row.taxAmount).toBe(3000);
    expect(row.explainability.map((line) => line.code)).toEqual(
      expect.arrayContaining(['TAX_FREE', 'BASIC_TAX', 'HIGH_TAX']),
    );
  });

  it('applies employee and employer insurance caps', () => {
    const cappedSetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 0,
        employeeInsuranceRatePercent: 10,
        employeeInsuranceCap: 1500,
        employerInsuranceRatePercent: 20,
        employerInsuranceCap: 4000,
      },
      deductionPolicies: [],
    } as HcmSetupConfig;

    const [row] = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [{ ...employee, grossSalary: 30000 }],
      setup: cappedSetup,
    }).rows;

    expect(row.employeeInsuranceAmount).toBe(1500);
    expect(row.employerInsuranceAmount).toBe(4000);
    expect(row.netSalary).toBe(28500);
  });

  it('separates pre-tax and post-tax deductions in taxable base and net pay', () => {
    const deductionSetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 10,
        employeeInsuranceRatePercent: 0,
        employerInsuranceRatePercent: 0,
      },
      deductionPolicies: [
        {
          code: 'RETIREMENT_PRE_TAX',
          label: 'Retirement contribution',
          active: true,
          type: 'FIXED_AMOUNT',
          amount: 1000,
          timing: 'PRE_TAX',
        },
        {
          code: 'LOAN_POST_TAX',
          label: 'Employee loan',
          active: true,
          type: 'FIXED_AMOUNT',
          amount: 500,
          timing: 'POST_TAX',
        },
      ],
    } as HcmSetupConfig;

    const [row] = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [employee],
      setup: deductionSetup,
    }).rows;

    expect(row.taxAmount).toBe(900);
    expect(row.policyDeductionAmount).toBe(1500);
    expect(row.netSalary).toBe(7600);
    expect(row.explainability.find((line) => line.code === 'TAX')?.formula).toContain('taxable base');
  });

  it('applies deduction eligibility by employee type, location, and effective dates', () => {
    const eligibilitySetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 0,
        employeeInsuranceRatePercent: 0,
      },
      deductionPolicies: [
        {
          code: 'HOURLY_LOCATION_DEDUCTION',
          label: 'Hourly Cairo deduction',
          active: true,
          type: 'FIXED_AMOUNT',
          amount: 200,
          appliesToEmployeeTypes: ['HOURLY'],
          locationCodes: ['CAIRO_HQ'],
          effectiveFrom: '2026-05-01',
          effectiveUntil: '2026-05-31',
        },
        {
          code: 'FUTURE_DEDUCTION',
          label: 'Future deduction',
          active: true,
          type: 'FIXED_AMOUNT',
          amount: 999,
          effectiveFrom: '2026-06-01',
        },
      ],
    } as HcmSetupConfig;

    const monthlyEmployee = {
      ...employee,
      employmentType: 'FULL_TIME',
      workLocationCode: 'CAIRO_HQ',
    } as PayrollCycleEmployeeInput & { employmentType: string };
    const hourlyEmployee = {
      ...employee,
      workerId: 'worker-2',
      employeeId: 'EMP-002',
      employmentType: 'HOURLY',
      workLocationCode: 'CAIRO_HQ',
    } as PayrollCycleEmployeeInput & { employmentType: string };

    const rows = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [monthlyEmployee, hourlyEmployee],
      setup: eligibilitySetup,
    }).rows;

    expect(rows.find((row) => row.workerId === 'worker-1')?.policyDeductionAmount).toBe(0);
    expect(rows.find((row) => row.workerId === 'worker-2')?.policyDeductionAmount).toBe(200);
    expect(rows.find((row) => row.workerId === 'worker-2')?.explainability.map((line) => line.code)).not.toContain('FUTURE_DEDUCTION');
  });

  it('applies deduction policies to specific workers only', () => {
    const workerScopedSetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 0,
        employeeInsuranceRatePercent: 0,
      },
      deductionPolicies: [
        {
          code: 'WORKER_ONLY_DEDUCTION',
          label: 'Worker specific deduction',
          active: true,
          type: 'FIXED_AMOUNT',
          amount: 350,
          workerIds: ['worker-2'],
        },
      ],
    } as HcmSetupConfig;

    const rows = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [
        { ...employee, workerId: 'worker-1', employeeId: 'EMP-001' },
        { ...employee, workerId: 'worker-2', employeeId: 'EMP-002' },
      ],
      setup: workerScopedSetup,
    }).rows;

    expect(rows.find((row) => row.workerId === 'worker-1')?.policyDeductionAmount).toBe(0);
    expect(rows.find((row) => row.workerId === 'worker-2')?.policyDeductionAmount).toBe(350);
  });

  it('calculates scoped deduction logic-ledger rules with caps and minimum net protection', () => {
    const logicLedgerSetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 0,
        employeeInsuranceRatePercent: 0,
      },
      deductionPolicies: [
        {
          code: 'ENTITY_LATE_LEDGER',
          label: 'Entity late penalty ledger',
          active: true,
          type: 'LOGIC_LEDGER',
          timing: 'POST_TAX',
          scope: {
            countryCodes: ['EG'],
            legalEntityIds: ['entity-eg'],
            departmentIds: ['FINANCE'],
          },
          logicLedger: {
            code: 'LATE_MINUTES_HIGH_RISK',
            label: 'High-risk late minutes',
            source: 'ATTENDANCE_LEDGER',
            base: 'ATTENDANCE_LATE_MINUTES',
            method: 'PER_UNIT',
            amount: 50,
            monthlyCap: 2000,
            minimumNetPay: 8500,
            posting: {
              payslipLineType: 'LATE_DEDUCTION',
              glAccount: '2200',
            },
            retroBehavior: 'ADJUSTMENT_QUEUE',
          },
        },
      ],
    } as HcmSetupConfig;

    const rows = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [
        {
          ...employee,
          countryCode: 'EG',
          legalEntityId: 'entity-eg',
          departmentId: 'FINANCE',
          attendanceSummary: { ...employee.attendanceSummary!, lateMinutes: 45 },
        },
        {
          ...employee,
          workerId: 'worker-2',
          employeeId: 'EMP-002',
          countryCode: 'US',
          legalEntityId: 'entity-us',
          departmentId: 'FINANCE',
          attendanceSummary: { ...employee.attendanceSummary!, lateMinutes: 45 },
        },
      ],
      setup: logicLedgerSetup,
    }).rows;

    const matchingRow = rows.find((row) => row.workerId === 'worker-1');
    const nonMatchingRow = rows.find((row) => row.workerId === 'worker-2');
    const logicLine = matchingRow?.explainability.find((line) => line.code === 'LATE_MINUTES_HIGH_RISK');

    expect(matchingRow?.policyDeductionAmount).toBe(1500);
    expect(matchingRow?.netSalary).toBe(8500);
    expect(logicLine).toEqual(expect.objectContaining({
      label: 'High-risk late minutes',
      amount: 1500,
      ledgerSource: 'ATTENDANCE_LEDGER',
      ledgerRuleCode: 'LATE_MINUTES_HIGH_RISK',
      glAccount: '2200',
      retroBehavior: 'ADJUSTMENT_QUEUE',
    }));
    expect(logicLine?.formula).toContain('minimum net 8500');
    expect(nonMatchingRow?.policyDeductionAmount).toBe(0);
  });

  it('treats a zero monthly cap as uncapped for logic-ledger rules', () => {
    const zeroCapSetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 0,
        employeeInsuranceRatePercent: 0,
      },
      deductionPolicies: [
        {
          code: 'ZERO_CAP_LATE_LEDGER',
          label: 'Zero cap late ledger',
          active: true,
          type: 'LOGIC_LEDGER',
          timing: 'POST_TAX',
          logicLedger: {
            code: 'LATE_MINUTES_UNCAPPED',
            label: 'Late minutes uncapped',
            source: 'ATTENDANCE_LEDGER',
            base: 'ATTENDANCE_LATE_MINUTES',
            method: 'PER_UNIT',
            amount: 50,
            monthlyCap: 0,
          },
        },
      ],
    } as HcmSetupConfig;

    const [row] = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [{
        ...employee,
        attendanceSummary: { ...employee.attendanceSummary!, lateMinutes: 45 },
      }],
      setup: zeroCapSetup,
    }).rows;

    expect(row.policyDeductionAmount).toBe(2250);
    expect(row.netSalary).toBe(7750);
    expect(row.explainability.find((line) => line.code === 'LATE_MINUTES_UNCAPPED')?.formula).not.toContain('monthly cap 0');
  });

  it('calculates scoped pre-tax deduction logic-ledger rules before tax with minimum net protection', () => {
    const logicLedgerSetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 10,
        employeeInsuranceRatePercent: 0,
      },
      deductionPolicies: [
        {
          code: 'ENTITY_LATE_LEDGER',
          label: 'Entity late penalty ledger',
          active: true,
          type: 'LOGIC_LEDGER',
          timing: 'PRE_TAX',
          scope: {
            countryCodes: ['EG'],
            legalEntityIds: ['entity-eg'],
            departmentIds: ['FINANCE'],
          },
          logicLedger: {
            code: 'LATE_MINUTES_HIGH_RISK',
            label: 'High-risk late minutes',
            source: 'ATTENDANCE_LEDGER',
            base: 'ATTENDANCE_LATE_MINUTES',
            method: 'PER_UNIT',
            amount: 50,
            monthlyCap: 2000,
            minimumNetPay: 8500,
            posting: {
              payslipLineType: 'LATE_DEDUCTION',
              glAccount: '2200',
            },
            retroBehavior: 'ADJUSTMENT_QUEUE',
          },
        },
      ],
    } as HcmSetupConfig;

    const rows = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [
        {
          ...employee,
          countryCode: 'EG',
          legalEntityId: 'entity-eg',
          departmentId: 'FINANCE',
          attendanceSummary: { ...employee.attendanceSummary!, lateMinutes: 45 },
        },
        {
          ...employee,
          workerId: 'worker-2',
          employeeId: 'EMP-002',
          countryCode: 'US',
          legalEntityId: 'entity-us',
          departmentId: 'FINANCE',
          attendanceSummary: { ...employee.attendanceSummary!, lateMinutes: 45 },
        },
      ],
      setup: logicLedgerSetup,
    }).rows;

    const matchingRow = rows.find((row) => row.workerId === 'worker-1');
    const nonMatchingRow = rows.find((row) => row.workerId === 'worker-2');
    const logicLine = matchingRow?.explainability.find((line) => line.code === 'LATE_MINUTES_HIGH_RISK');

    expect(matchingRow?.policyDeductionAmount).toBe(555.56);
    expect(matchingRow?.taxAmount).toBe(944.44);
    expect(matchingRow?.netSalary).toBe(8500);
    expect(logicLine).toEqual(expect.objectContaining({
      label: 'High-risk late minutes',
      amount: 555.56,
      ledgerSource: 'ATTENDANCE_LEDGER',
      ledgerRuleCode: 'LATE_MINUTES_HIGH_RISK',
      glAccount: '2200',
      retroBehavior: 'ADJUSTMENT_QUEUE',
    }));
    expect(logicLine?.formula).toContain('minimum net 8500');
    expect(logicLine?.formula).toContain('pre-tax');
    expect(nonMatchingRow?.policyDeductionAmount).toBe(0);
    expect(nonMatchingRow?.taxAmount).toBe(1000);
    expect(nonMatchingRow?.netSalary).toBe(9000);
  });

  it('fails fast when logic-ledger rules require a pipeline base before it is calculated', () => {
    const logicLedgerSetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 10,
        employeeInsuranceRatePercent: 0,
      },
      deductionPolicies: [
        {
          code: 'TAXABLE_BASE_LEDGER',
          label: 'Taxable base deduction',
          active: true,
          type: 'LOGIC_LEDGER',
          timing: 'POST_TAX',
          logicLedger: {
            code: 'TAXABLE_BASE_RULE',
            source: 'PAYROLL_LEDGER',
            base: 'TAXABLE_BASE',
            method: 'PERCENT_OF_BASE',
            ratePercent: 5,
          },
        },
      ],
    } as HcmSetupConfig;

    expect(() => service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [employee],
      setup: logicLedgerSetup,
    })).toThrow(/TAXABLE_BASE_RULE requires TAXABLE_BASE/);
  });

  it('adds scoped taxable and non-taxable earnings before gross-to-net calculation', () => {
    const earningsSetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 10,
        employeeInsuranceRatePercent: 5,
      },
      earningPolicies: [
        {
          code: 'HOUSING_ALLOWANCE',
          label: 'Housing allowance',
          active: true,
          type: 'FIXED_AMOUNT',
          amount: 1200,
          taxable: true,
          insurable: true,
          workerIds: ['worker-1'],
        },
        {
          code: 'TRANSPORT_ALLOWANCE',
          label: 'Transport allowance',
          active: true,
          type: 'FIXED_AMOUNT',
          amount: 300,
          taxable: false,
          insurable: false,
          workerIds: ['worker-1'],
        },
      ],
    } as HcmSetupConfig;

    const rows = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [
        { ...employee, workerId: 'worker-1', employeeId: 'EMP-001' },
        { ...employee, workerId: 'worker-2', employeeId: 'EMP-002' },
      ],
      setup: earningsSetup,
    }).rows;
    const workerOne = rows.find((row) => row.workerId === 'worker-1');
    const workerTwo = rows.find((row) => row.workerId === 'worker-2');

    expect(workerOne).toEqual(expect.objectContaining({
      baseGrossSalary: 10000,
      earningAmount: 1500,
      taxableEarningAmount: 1200,
      nonTaxableEarningAmount: 300,
      grossSalary: 11500,
      taxAmount: 1120,
      employeeInsuranceAmount: 560,
      policyDeductionAmount: 160,
      netSalary: 9660,
    }));
    expect(workerOne?.explainability.map((line) => line.code)).toEqual(expect.arrayContaining([
      'HOUSING_ALLOWANCE',
      'TRANSPORT_ALLOWANCE',
    ]));
    expect(workerTwo?.earningAmount).toBe(0);
    expect(workerTwo?.grossSalary).toBe(10000);
  });

  it('adds logic-ledger earnings from attendance units with payroll posting evidence', () => {
    const logicLedgerSetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 0,
        employeeInsuranceRatePercent: 0,
      },
      deductionPolicies: [],
      earningPolicies: [
        {
          code: 'ENTITY_OVERTIME_PREMIUM',
          label: 'Entity overtime premium',
          active: true,
          type: 'LOGIC_LEDGER',
          taxable: false,
          insurable: false,
          scope: {
            legalEntityIds: ['entity-eg'],
            locationCodes: ['CAIRO_HQ'],
          },
          logicLedger: {
            code: 'OVERTIME_HOUR_PREMIUM',
            label: 'Overtime hour premium',
            source: 'ATTENDANCE_LEDGER',
            base: 'ATTENDANCE_OVERTIME_HOURS',
            method: 'PER_UNIT',
            amount: 125,
            monthlyCap: 500,
            posting: {
              payslipLineType: 'OVERTIME_EARNING',
              glAccount: '6100',
            },
            retroBehavior: 'FUTURE_ONLY',
          },
        },
      ],
    } as HcmSetupConfig;

    const [row] = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [{
        ...employee,
        legalEntityId: 'entity-eg',
        attendanceSummary: { ...employee.attendanceSummary!, overtimeMinutes: 180 },
      }],
      setup: logicLedgerSetup,
    }).rows;
    const logicLine = row.explainability.find((line) => line.code === 'OVERTIME_HOUR_PREMIUM');

    expect(row.earningAmount).toBe(375);
    expect(row.taxableEarningAmount).toBe(0);
    expect(logicLine).toEqual(expect.objectContaining({
      label: 'Overtime hour premium',
      amount: 375,
      ledgerSource: 'ATTENDANCE_LEDGER',
      ledgerRuleCode: 'OVERTIME_HOUR_PREMIUM',
      glAccount: '6100',
      retroBehavior: 'FUTURE_ONLY',
    }));
    expect(logicLine?.formula).toContain('ATTENDANCE_OVERTIME_HOURS');
  });

  it('calculates hourly employee gross pay from payable attendance minutes', () => {
    const hourlyEmployee = {
      ...employee,
      grossSalary: 0,
      employmentType: 'HOURLY',
      salaryBasis: 'HOURLY',
      hourlyRate: 125,
      attendanceSummary: {
        ...employee.attendanceSummary!,
        payableMinutes: 4800,
      },
    } as PayrollCycleEmployeeInput & { employmentType: string; salaryBasis: 'HOURLY'; hourlyRate: number };

    const hourlySetup = {
      ...setup,
      payrollCalculationPolicy: {
        taxRatePercent: 0,
        employeeInsuranceRatePercent: 0,
      },
      deductionPolicies: [],
    } as HcmSetupConfig;

    const [row] = service.buildMonthlyCycle({
      year: 2026,
      month: 5,
      employees: [hourlyEmployee],
      setup: hourlySetup,
    }).rows;

    expect(row.grossSalary).toBe(10000);
    expect(row.explainability.find((line) => line.code === 'GROSS')?.formula).toBe('125 hourly rate * 80 payable hours');
  });
});
