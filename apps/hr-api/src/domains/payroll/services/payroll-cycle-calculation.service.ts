import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { HcmPolicyScope, HcmSetupConfig, PayrollPolicyLogicLedgerRule } from '../../hcm-setup/hcm-setup.types.js';
import type { AttendanceMonthlySummary } from '../../time-attendance/services/attendance-calculation.service.js';
import { PayrollStatutoryPolicyService } from './payroll-statutory-policy.service.js';

export interface PayrollBankAccount {
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  iban?: string;
  routingNumber?: string;
  swiftCode?: string;
}

export interface PayrollCycleEmployeeInput {
  workerId: string;
  employeeId: string;
  name: string;
  email: string;
  department?: string;
  departmentId?: string;
  legalEntityId?: string;
  orgUnitId?: string;
  countryCode?: string;
  tenantId?: string;
  workLocationCode?: string;
  employmentType?: string;
  salaryBasis?: 'MONTHLY' | 'HOURLY';
  hourlyRate?: number;
  grossSalary: number;
  currency: string;
  attendanceSummary?: AttendanceMonthlySummary;
  bankAccount?: PayrollBankAccount;
  taxIdentifier?: string;
  insuranceIdentifier?: string;
}

export interface PayrollExplainabilityLine {
  code: string;
  label: string;
  amount: number;
  source: 'ATTENDANCE' | 'COMPENSATION' | 'POLICY' | 'EARNING';
  formula: string;
  ledgerSource?: string;
  ledgerRuleCode?: string;
  calculationBase?: string;
  calculationMethod?: string;
  glAccount?: string;
  payslipLineType?: string;
  retroBehavior?: string;
  scopeMatch?: HcmPolicyScope;
}

type CalculationPeriod = {
  periodStart: string;
  periodEnd: string;
};

export interface PayrollCycleRow {
  workerId: string;
  employeeId: string;
  name: string;
  email: string;
  department?: string;
  employmentType?: string;
  salaryBasis?: 'MONTHLY' | 'HOURLY';
  workLocationCode?: string;
  baseGrossSalary: number | null;
  earningAmount: number | null;
  taxableEarningAmount: number | null;
  nonTaxableEarningAmount: number | null;
  grossSalary: number | null;
  taxAmount: number | null;
  employeeInsuranceAmount: number | null;
  employerInsuranceAmount: number | null;
  policyDeductionAmount: number | null;
  netSalary: number | null;
  currency: string;
  attendanceSummary?: AttendanceMonthlySummary;
  explainability: PayrollExplainabilityLine[];
  bankAccount?: PayrollBankAccount;
  taxIdentifier?: string;
  insuranceIdentifier?: string;
  policyAssignmentWarnings?: string[];
}

export interface PayrollBankTransferRow {
  employeeId: string;
  workerId: string;
  name: string;
  workEmail: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  iban: string;
  routingNumber: string;
  swiftCode: string;
  netSalary: number | null;
  currency: string;
  bankReady: boolean;
  readinessReason: 'READY' | 'MISSING_ACCOUNT_IDENTIFIER' | 'MISSING_BANK_NAME' | 'MISSING_NET_SALARY';
}

export interface PayrollResultLineDraft {
  workerId: string;
  payrollCycleId: string;
  calculationRunId: string;
  lineType: string;
  description: string;
  amount: number;
  currency: string;
  ruleSetId?: string;
  ruleId?: string;
  calculationStep: string;
  inputSnapshotHash: string;
  explanation: string;
}

export interface PayrollPayslipLine {
  id: string;
  workerId: string;
  lineType: string;
  description: string;
  amount: number;
  currency: string;
  ruleSetId?: string;
  explanation?: string;
  status?: string;
}

export interface PayrollPayslip {
  id: string;
  workerId: string;
  employeeId: string;
  employeeName: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  grossPay: number;
  netPay: number;
  deductions: number;
  taxes: number;
  currency: string;
  lines: PayrollPayslipLine[];
}

export interface PayrollCyclePreview {
  id: string;
  name: string;
  year: number;
  month: number;
  calendarDays: number;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  employeeCount: number;
  totalGross: number;
  totalTax: number;
  totalEmployeeInsurance: number;
  totalEmployerInsurance: number;
  totalPolicyDeductions: number;
  totalNet: number;
  currency: string;
  rows: PayrollCycleRow[];
}

export interface PayrollActorVisibility {
  roles: string[];
  workerId?: string;
}

export interface LockedAttendanceSnapshotSummaryInput {
  status: string;
  workedMinutes: number;
  payableMinutes: number;
  deductionMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  locationStatus: string;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function datePart(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function deductionMinutes(attendance: AttendanceMonthlySummary | undefined, eventCode: string | undefined): number {
  if (!attendance || !eventCode) return 0;
  switch (eventCode) {
    case 'ABSENCE':
      return attendance.absentDays;
    case 'LATE':
      return attendance.lateMinutes;
    case 'UNDERTIME':
      return attendance.undertimeMinutes;
    case 'OVERTIME':
      return attendance.overtimeMinutes;
    case 'GEOFENCE_VIOLATION':
      return attendance.geofenceViolations;
    default:
      return 0;
  }
}

function attendanceBaseValue(attendance: AttendanceMonthlySummary | undefined, base: PayrollPolicyLogicLedgerRule['base']): number {
  if (!attendance) return 0;
  switch (base) {
    case 'ATTENDANCE_LATE_MINUTES':
      return attendance.lateMinutes;
    case 'ATTENDANCE_UNDERTIME_MINUTES':
      return attendance.undertimeMinutes;
    case 'ATTENDANCE_OVERTIME_MINUTES':
      return attendance.overtimeMinutes;
    case 'ATTENDANCE_OVERTIME_HOURS':
      return attendance.overtimeMinutes / 60;
    case 'ATTENDANCE_ABSENCE_DAYS':
      return attendance.absentDays;
    case 'ATTENDANCE_PAYABLE_MINUTES':
      return attendance.payableMinutes;
    case 'ATTENDANCE_WORKED_MINUTES':
      return attendance.workedMinutes;
    case 'ATTENDANCE_GEOFENCE_VIOLATIONS':
      return attendance.geofenceViolations;
    default:
      return 0;
  }
}

function earningUnits(attendance: AttendanceMonthlySummary | undefined, eventCode: string | undefined): number {
  if (!attendance || !eventCode) return 0;
  switch (eventCode) {
    case 'OVERTIME':
      return attendance.overtimeMinutes;
    case 'ON_DUTY':
      return attendance.onDutyMinutes;
    case 'WORKED':
      return attendance.workedMinutes;
    case 'PAYABLE':
      return attendance.payableMinutes;
    default:
      return 0;
  }
}

function minOptional(value: number, cap: number | undefined): number {
  return cap === undefined || cap < 0 ? value : Math.min(value, cap);
}

function overlapsPeriod(period: CalculationPeriod, effectiveFrom?: string, effectiveUntil?: string): boolean {
  if (effectiveFrom && effectiveFrom > period.periodEnd) return false;
  if (effectiveUntil && effectiveUntil < period.periodStart) return false;
  return true;
}

function matchesOptionalList(values: string[] | undefined, candidate: string | undefined): boolean {
  return !values?.length || Boolean(candidate && values.includes(candidate));
}

function matchesAnyOptionalList(values: string[] | undefined, candidates: Array<string | undefined>): boolean {
  return !values?.length || candidates.some((candidate) => Boolean(candidate && values.includes(candidate)));
}

function scopeApplies(scope: HcmPolicyScope | undefined, employee: PayrollCycleEmployeeInput, period: CalculationPeriod): boolean {
  if (!scope) return true;
  if (!overlapsPeriod(period, scope.effectiveFrom, scope.effectiveUntil)) return false;
  const employeeType = employee.employmentType ?? employee.salaryBasis;
  return matchesOptionalList(scope.workerIds, employee.workerId)
    && matchesOptionalList(scope.employeeTypes, employeeType)
    && matchesOptionalList(scope.legalEntityIds, employee.legalEntityId)
    && matchesOptionalList(scope.orgUnitIds, employee.orgUnitId)
    && matchesOptionalList(scope.countryCodes, employee.countryCode)
    && matchesOptionalList(scope.locationCodes, employee.workLocationCode)
    && matchesAnyOptionalList(scope.departmentIds, [employee.departmentId, employee.department])
    && matchesOptionalList(scope.tenantId ? [scope.tenantId] : undefined, employee.tenantId);
}

function assignedPolicyApplies(
  policy: {
    active: boolean;
    effectiveFrom?: string;
    effectiveUntil?: string;
    scope?: HcmPolicyScope;
    workerIds?: string[];
    employeeIds?: string[];
    appliesToEmployeeTypes?: string[];
    departmentCodes?: string[];
    locationCodes?: string[];
  },
  employee: PayrollCycleEmployeeInput,
  period: CalculationPeriod,
): boolean {
  if (!policy.active) return false;
  if (!overlapsPeriod(period, policy.effectiveFrom, policy.effectiveUntil)) return false;
  if (!scopeApplies(policy.scope, employee, period)) return false;
  const employeeType = employee.employmentType ?? employee.salaryBasis;
  return matchesOptionalList(policy.workerIds, employee.workerId)
    && matchesOptionalList(policy.employeeIds, employee.employeeId)
    && matchesOptionalList(policy.appliesToEmployeeTypes, employeeType)
    && matchesAnyOptionalList(policy.departmentCodes, [employee.department, employee.departmentId])
    && matchesOptionalList(policy.locationCodes, employee.workLocationCode);
}

function deductionApplies(
  deduction: NonNullable<HcmSetupConfig['deductionPolicies']>[number],
  employee: PayrollCycleEmployeeInput,
  period: CalculationPeriod,
): boolean {
  return assignedPolicyApplies(deduction, employee, period);
}

function earningApplies(
  earning: NonNullable<HcmSetupConfig['earningPolicies']>[number],
  employee: PayrollCycleEmployeeInput,
  period: CalculationPeriod,
): boolean {
  return assignedPolicyApplies(earning, employee, period);
}

function canSeeSalary(actor: PayrollActorVisibility, workerId: string): boolean {
  return actor.workerId === workerId || actor.roles.some((role) => ['HR_ADMIN', 'PAYROLL_ADMIN', 'SUPER_ADMIN'].includes(role));
}

function hashSnapshot(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

type PayrollPolicyWithLedger = {
  code: string;
  label: string;
  type: string;
  amount?: number;
  ratePercent?: number;
  maxAmount?: number;
  taxable?: boolean;
  insurable?: boolean;
  timing?: 'PRE_TAX' | 'POST_TAX';
  attendanceEvent?: string;
  scope?: HcmPolicyScope;
  logicLedger?: PayrollPolicyLogicLedgerRule;
  calculationLedger?: PayrollPolicyLogicLedgerRule[];
  glPosting?: PayrollPolicyLogicLedgerRule['posting'];
  retroBehavior?: PayrollPolicyLogicLedgerRule['retroBehavior'];
};

type LogicEvaluationContext = {
  employee: PayrollCycleEmployeeInput;
  baseGrossSalary: number;
  grossSalary: number;
  taxableBase?: number;
  netBeforeDeductions?: number;
};

type EvaluatedPolicyComponent<T extends PayrollPolicyWithLedger> = {
  policy: T;
  amount: number;
  formula: string;
  logicRule?: PayrollPolicyLogicLedgerRule;
  ledgerSource?: string;
  ledgerRuleCode?: string;
  calculationBase?: string;
  calculationMethod?: string;
  glAccount?: string;
  payslipLineType?: string;
  retroBehavior?: string;
  scopeMatch?: HcmPolicyScope;
  minimumNetPay?: number;
};

function ledgerRules(policy: PayrollPolicyWithLedger): PayrollPolicyLogicLedgerRule[] {
  const rules = policy.calculationLedger?.length ? policy.calculationLedger : policy.logicLedger ? [policy.logicLedger] : [];
  return rules
    .filter((rule) => rule.active !== false)
    .sort((left, right) => (left.priority ?? 1000) - (right.priority ?? 1000));
}

function baseValueForRule(rule: PayrollPolicyLogicLedgerRule, context: LogicEvaluationContext): number {
  switch (rule.base) {
    case 'FIXED_AMOUNT':
      return 1;
    case 'BASE_GROSS':
      return context.baseGrossSalary;
    case 'GROSS_SALARY':
      return context.grossSalary;
    case 'TAXABLE_BASE':
      return context.taxableBase ?? context.grossSalary;
    case 'NET_BEFORE_DEDUCTION':
      return context.netBeforeDeductions ?? context.grossSalary;
    case 'HOURLY_RATE':
      return context.employee.hourlyRate ?? 0;
    default:
      return attendanceBaseValue(context.employee.attendanceSummary, rule.base);
  }
}

function evaluateBracketRule(baseValue: number, rule: PayrollPolicyLogicLedgerRule): number {
  let amount = 0;
  for (const bracket of [...(rule.brackets ?? [])].sort((left, right) => left.thresholdFrom - right.thresholdFrom)) {
    const upper = bracket.thresholdTo ?? baseValue;
    const slice = Math.max(Math.min(baseValue, upper) - bracket.thresholdFrom, 0);
    if (slice <= 0) continue;
    amount += bracket.amount ?? (slice * ((bracket.ratePercent ?? 0) / 100));
  }
  return amount;
}

function capAndFloorAmount(amount: number, rule: PayrollPolicyLogicLedgerRule, fallbackMaxAmount?: number): { amount: number; notes: string[] } {
  const notes: string[] = [];
  let evaluated = amount;
  if (rule.floorAmount !== undefined && evaluated < rule.floorAmount) {
    evaluated = rule.floorAmount;
    notes.push(`floor ${rule.floorAmount}`);
  }
  const cap = rule.monthlyCap ?? fallbackMaxAmount;
  if (cap !== undefined && cap >= 0 && evaluated > cap) {
    evaluated = cap;
    notes.push(`monthly cap ${cap}`);
  }
  return { amount: roundMoney(evaluated), notes };
}

function evaluateLogicRule(
  policy: PayrollPolicyWithLedger,
  rule: PayrollPolicyLogicLedgerRule,
  context: LogicEvaluationContext,
): EvaluatedPolicyComponent<PayrollPolicyWithLedger> {
  const baseValue = baseValueForRule(rule, context);
  const multiplier = rule.multiplier ?? 1;
  let rawAmount = 0;
  let formula = '';

  if (rule.method === 'FIXED_AMOUNT') {
    rawAmount = rule.amount ?? 0;
    formula = `${rule.amount ?? 0}`;
  } else if (rule.method === 'PERCENT_OF_BASE') {
    rawAmount = baseValue * ((rule.ratePercent ?? 0) / 100) * multiplier;
    formula = `${rule.base} ${roundMoney(baseValue)} * ${rule.ratePercent ?? 0}%`;
  } else if (rule.method === 'PER_UNIT') {
    rawAmount = baseValue * (rule.amount ?? 0) * multiplier;
    formula = `${rule.base} ${roundMoney(baseValue)} * ${rule.amount ?? 0}`;
  } else if (rule.method === 'BRACKET') {
    rawAmount = evaluateBracketRule(baseValue, rule) * multiplier;
    formula = `${rule.base} ${roundMoney(baseValue)} using ${rule.brackets?.length ?? 0} brackets`;
  }

  const capped = capAndFloorAmount(rawAmount, rule, policy.maxAmount);
  if (capped.notes.length > 0) formula = `${formula}; ${capped.notes.join('; ')}`;

  return {
    policy,
    amount: capped.amount,
    formula,
    logicRule: rule,
    ledgerSource: rule.source,
    ledgerRuleCode: rule.code,
    calculationBase: rule.base,
    calculationMethod: rule.method,
    glAccount: rule.posting?.glAccount ?? policy.glPosting?.glAccount,
    payslipLineType: rule.posting?.payslipLineType ?? policy.glPosting?.payslipLineType,
    retroBehavior: rule.retroBehavior ?? policy.retroBehavior,
    scopeMatch: policy.scope,
    minimumNetPay: rule.minimumNetPay,
  };
}

@Injectable()
export class PayrollCycleCalculationService {
  private readonly statutoryPolicy = new PayrollStatutoryPolicyService();

  summarizeLockedAttendanceSnapshots(snapshots: LockedAttendanceSnapshotSummaryInput[]): AttendanceMonthlySummary {
    return {
      workedMinutes: snapshots.reduce((total, snapshot) => total + snapshot.workedMinutes, 0),
      payableMinutes: snapshots.reduce((total, snapshot) => total + snapshot.payableMinutes, 0),
      lateMinutes: snapshots.reduce((total, snapshot) => total + snapshot.lateMinutes, 0),
      undertimeMinutes: snapshots.reduce((total, snapshot) => total + snapshot.undertimeMinutes, 0),
      overtimeMinutes: snapshots.reduce((total, snapshot) => total + snapshot.overtimeMinutes, 0),
      absentDays: snapshots.filter((snapshot) => snapshot.status === 'ABSENT').length,
      onDutyMinutes: 0,
      geofenceViolations: snapshots.filter((snapshot) => snapshot.status === 'GEOFENCE_VIOLATION' || snapshot.locationStatus === 'OUTSIDE_GEOFENCE').length,
    };
  }

  buildMonthlyCycle(input: {
    year: number;
    month: number;
    employees: PayrollCycleEmployeeInput[];
    setup: HcmSetupConfig;
    workLocationCode?: string;
  }): PayrollCyclePreview {
    const periodStart = new Date(Date.UTC(input.year, input.month - 1, 1));
    const periodEnd = new Date(Date.UTC(input.year, input.month, 0));
    const calendarDays = periodEnd.getUTCDate();
    const filteredEmployees = input.workLocationCode
      ? input.employees.filter((employee) => employee.workLocationCode === input.workLocationCode)
      : input.employees;
    const period = { periodStart: datePart(periodStart), periodEnd: datePart(periodEnd) };
    const rows = filteredEmployees.map((employee) => this.calculateRow(employee, input.setup, period));
    const currency = rows[0]?.currency ?? input.setup.locations?.[0]?.currency ?? 'EGP';

    return {
      id: `${input.year}-${input.month.toString().padStart(2, '0')}`,
      name: `${periodStart.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${input.year} Payroll`,
      year: input.year,
      month: input.month,
      calendarDays,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      payDate: datePart(periodEnd),
      employeeCount: rows.length,
      totalGross: roundMoney(rows.reduce((total, row) => total + (row.grossSalary ?? 0), 0)),
      totalTax: roundMoney(rows.reduce((total, row) => total + (row.taxAmount ?? 0), 0)),
      totalEmployeeInsurance: roundMoney(rows.reduce((total, row) => total + (row.employeeInsuranceAmount ?? 0), 0)),
      totalEmployerInsurance: roundMoney(rows.reduce((total, row) => total + (row.employerInsuranceAmount ?? 0), 0)),
      totalPolicyDeductions: roundMoney(rows.reduce((total, row) => total + (row.policyDeductionAmount ?? 0), 0)),
      totalNet: roundMoney(rows.reduce((total, row) => total + (row.netSalary ?? 0), 0)),
      currency,
      rows,
    };
  }

  calculateRow(employee: PayrollCycleEmployeeInput, setup: HcmSetupConfig, period?: CalculationPeriod): PayrollCycleRow {
    const calculationPeriod = period ?? { periodStart: '0000-01-01', periodEnd: '9999-12-31' };
    const payableHours = roundMoney((employee.attendanceSummary?.payableMinutes ?? 0) / 60);
    const isHourly = employee.salaryBasis === 'HOURLY' || employee.employmentType === 'HOURLY';
    const baseGrossSalary = roundMoney(isHourly && employee.hourlyRate !== undefined
      ? employee.hourlyRate * payableHours
      : employee.grossSalary);
    const statutoryResolution = this.statutoryPolicy.resolveCalculationPolicy(setup, employee);
    const policy = statutoryResolution.policy;
    const explainability: PayrollExplainabilityLine[] = [
      {
        code: 'GROSS',
        label: 'Base gross salary',
        amount: baseGrossSalary,
        source: 'COMPENSATION',
        formula: isHourly && employee.hourlyRate !== undefined
          ? `${employee.hourlyRate} hourly rate * ${payableHours} payable hours`
          : 'Employee compensation gross salary',
      },
    ];
    if (statutoryResolution.pack) {
      explainability.push({
        code: statutoryResolution.pack.code,
        label: statutoryResolution.pack.label,
        amount: 0,
        source: 'POLICY',
        formula: `Statutory payroll pack selected for ${statutoryResolution.pack.countryCode}`,
      });
    }

    const applicableEarnings = (setup.earningPolicies ?? [])
      .filter((earning) => earningApplies(earning, employee, calculationPeriod))
      .sort((left, right) => (left.priority ?? 1000) - (right.priority ?? 1000));

    const evaluatedEarnings = applicableEarnings.flatMap((earning) => {
      const rules = ledgerRules(earning);
      if (earning.type === 'LOGIC_LEDGER' || rules.length > 0) {
        return rules.map((rule) => evaluateLogicRule(earning, rule, {
          employee,
          baseGrossSalary,
          grossSalary: baseGrossSalary,
        }));
      }

      const unitCount = earningUnits(employee.attendanceSummary, earning.attendanceEvent);
      let amount = 0;
      let formula = '';

      if (earning.type === 'FIXED_AMOUNT') {
        amount = earning.amount ?? 0;
        formula = `${earning.amount ?? 0}`;
      } else if (earning.type === 'PERCENT_OF_BASE') {
        amount = baseGrossSalary * ((earning.ratePercent ?? 0) / 100);
        formula = `base gross ${baseGrossSalary} * ${earning.ratePercent ?? 0}%`;
      } else if (earning.type === 'PER_MINUTE') {
        amount = unitCount * (earning.amount ?? 0);
        formula = `${unitCount} ${earning.attendanceEvent?.toLowerCase() ?? 'attendance'} minutes * ${earning.amount ?? 0}`;
      }

      return [{
        earning,
        policy: earning,
        amount: roundMoney(minOptional(amount, earning.maxAmount)),
        formula,
      }];
    });

    for (const item of evaluatedEarnings) {
      if (item.amount > 0) {
        explainability.push({
          code: item.policy.code,
          label: item.policy.label,
          amount: item.amount,
          source: 'EARNING',
          formula: item.formula,
          ledgerSource: item.ledgerSource,
          ledgerRuleCode: item.ledgerRuleCode,
          calculationBase: item.calculationBase,
          calculationMethod: item.calculationMethod,
          glAccount: item.glAccount,
          payslipLineType: item.payslipLineType,
          retroBehavior: item.retroBehavior,
          scopeMatch: item.scopeMatch,
        });
      }
    }

    const earningAmount = roundMoney(evaluatedEarnings.reduce((total, item) => total + item.amount, 0));
    const taxableEarningAmount = roundMoney(evaluatedEarnings
      .filter((item) => item.policy.taxable)
      .reduce((total, item) => total + item.amount, 0));
    const nonTaxableEarningAmount = roundMoney(evaluatedEarnings
      .filter((item) => !item.policy.taxable)
      .reduce((total, item) => total + item.amount, 0));
    const insurableEarningAmount = roundMoney(evaluatedEarnings
      .filter((item) => item.policy.insurable ?? item.policy.taxable)
      .reduce((total, item) => total + item.amount, 0));
    const grossSalary = roundMoney(baseGrossSalary + earningAmount);

    const applicableDeductions = (setup.deductionPolicies ?? [])
      .filter((deduction) => deductionApplies(deduction, employee, calculationPeriod))
      .sort((left, right) => (left.priority ?? 1000) - (right.priority ?? 1000));

    let evaluatedDeductions = applicableDeductions.flatMap((deduction) => {
        const rules = ledgerRules(deduction);
        if (deduction.type === 'LOGIC_LEDGER' || rules.length > 0) {
          return rules.map((rule) => evaluateLogicRule(deduction, rule, {
            employee,
            baseGrossSalary,
            grossSalary,
          }));
        }

        const unitCount = deductionMinutes(employee.attendanceSummary, deduction.attendanceEvent);
        let amount = 0;
        let formula = '';

        if (deduction.type === 'FIXED_AMOUNT') {
          amount = deduction.amount ?? 0;
          formula = `${deduction.amount ?? 0}`;
        } else if (deduction.type === 'PERCENT_OF_GROSS') {
          amount = grossSalary * ((deduction.ratePercent ?? 0) / 100);
          formula = `gross * ${deduction.ratePercent ?? 0}%`;
        } else if (deduction.type === 'PER_MINUTE') {
          amount = unitCount * (deduction.amount ?? 0);
          formula = `${unitCount} * ${deduction.amount ?? 0}`;
        }

        return [{
          deduction,
          policy: deduction,
          amount: roundMoney(minOptional(amount, deduction.maxAmount)),
          formula,
        }];
      });

    const preTaxDeductionAmount = roundMoney(evaluatedDeductions
      .filter((item) => item.policy.timing === 'PRE_TAX')
      .reduce((total, item) => total + item.amount, 0));
    const taxableBase = roundMoney(Math.max(baseGrossSalary + taxableEarningAmount - preTaxDeductionAmount, 0));

    let taxAmount = 0;
    if (policy.taxMode === 'PROGRESSIVE_BRACKETS' && policy.taxBrackets?.length) {
      const brackets = [...policy.taxBrackets].sort((left, right) => left.thresholdFrom - right.thresholdFrom);
      for (const bracket of brackets) {
        const bracketUpper = bracket.thresholdTo ?? taxableBase;
        const taxableSlice = Math.max(Math.min(taxableBase, bracketUpper) - bracket.thresholdFrom, 0);
        const bracketTax = roundMoney(taxableSlice * (bracket.ratePercent / 100));
        taxAmount += bracketTax;
        explainability.push({
          code: bracket.code,
          label: bracket.label ?? bracket.code,
          amount: bracketTax,
          source: 'POLICY',
          formula: `${taxableSlice} taxable base slice * ${bracket.ratePercent}%`,
        });
      }
      taxAmount = roundMoney(taxAmount);
    } else {
      taxAmount = roundMoney(taxableBase * (policy.taxRatePercent / 100));
      explainability.push({
        code: 'TAX',
        label: 'Payroll tax',
        amount: taxAmount,
        source: 'POLICY',
        formula: `taxable base ${taxableBase} * ${policy.taxRatePercent}%`,
      });
    }

    const insuranceBase = roundMoney(baseGrossSalary + insurableEarningAmount);
    const employeeInsuranceRaw = insuranceBase * (policy.employeeInsuranceRatePercent / 100);
    const employerInsuranceRaw = insuranceBase * ((policy.employerInsuranceRatePercent ?? 0) / 100);
    const employeeInsuranceAmount = roundMoney(minOptional(employeeInsuranceRaw, policy.employeeInsuranceCap));
    const employerInsuranceAmount = roundMoney(minOptional(employerInsuranceRaw, policy.employerInsuranceCap));
    explainability.push(
      {
        code: 'EMPLOYEE_INSURANCE',
        label: 'Employee insurance',
        amount: employeeInsuranceAmount,
        source: 'POLICY',
        formula: policy.employeeInsuranceCap !== undefined
          ? `min(insurable base ${insuranceBase} * ${policy.employeeInsuranceRatePercent}%, ${policy.employeeInsuranceCap})`
          : `insurable base ${insuranceBase} * ${policy.employeeInsuranceRatePercent}%`,
      },
      {
        code: 'EMPLOYER_INSURANCE',
        label: 'Employer insurance',
        amount: employerInsuranceAmount,
        source: 'POLICY',
        formula: policy.employerInsuranceCap !== undefined
          ? `min(insurable base ${insuranceBase} * ${policy.employerInsuranceRatePercent ?? 0}%, ${policy.employerInsuranceCap})`
          : `insurable base ${insuranceBase} * ${policy.employerInsuranceRatePercent ?? 0}%`,
      },
    );

    let deductionTotalBeforeCurrent = 0;
    evaluatedDeductions = evaluatedDeductions.map((item) => {
      if (item.minimumNetPay === undefined) {
        deductionTotalBeforeCurrent += item.amount;
        return item;
      }

      const maxAllowed = Math.max(grossSalary - taxAmount - employeeInsuranceAmount - deductionTotalBeforeCurrent - item.minimumNetPay, 0);
      const protectedAmount = roundMoney(Math.min(item.amount, maxAllowed));
      deductionTotalBeforeCurrent += protectedAmount;
      if (protectedAmount === item.amount) return item;

      return {
        ...item,
        amount: protectedAmount,
        formula: `${item.formula}; minimum net ${item.minimumNetPay}`,
      };
    });

    for (const item of evaluatedDeductions) {
      if (item.amount > 0) {
        explainability.push({
          code: item.policy.code,
          label: item.policy.label,
          amount: item.amount,
          source: item.ledgerSource === 'ATTENDANCE_LEDGER' || item.policy.attendanceEvent ? 'ATTENDANCE' : 'POLICY',
          formula: item.policy.timing === 'PRE_TAX' ? `${item.formula}; pre-tax` : item.formula,
          ledgerSource: item.ledgerSource,
          ledgerRuleCode: item.ledgerRuleCode,
          calculationBase: item.calculationBase,
          calculationMethod: item.calculationMethod,
          glAccount: item.glAccount,
          payslipLineType: item.payslipLineType,
          retroBehavior: item.retroBehavior,
          scopeMatch: item.scopeMatch,
        });
      }
    }

    const roundedPolicyDeductions = roundMoney(evaluatedDeductions.reduce((total, item) => total + item.amount, 0));
    const netSalary = roundMoney(Math.max(grossSalary - taxAmount - employeeInsuranceAmount - roundedPolicyDeductions, 0));
    const policyAssignmentWarnings = (setup.earningPolicies ?? []).some((earning) => earning.active)
      && applicableEarnings.length === 0
      ? ['No earning policy assigned']
      : [];

    return {
      workerId: employee.workerId,
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      employmentType: employee.employmentType,
      salaryBasis: employee.salaryBasis,
      workLocationCode: employee.workLocationCode,
      baseGrossSalary,
      earningAmount,
      taxableEarningAmount,
      nonTaxableEarningAmount,
      grossSalary,
      taxAmount,
      employeeInsuranceAmount,
      employerInsuranceAmount,
      policyDeductionAmount: roundedPolicyDeductions,
      netSalary,
      currency: employee.currency,
      attendanceSummary: employee.attendanceSummary,
      explainability,
      bankAccount: employee.bankAccount,
      taxIdentifier: employee.taxIdentifier,
      insuranceIdentifier: employee.insuranceIdentifier,
      policyAssignmentWarnings,
    };
  }

  buildBankTransferRows(rows: PayrollCycleRow[]): PayrollBankTransferRow[] {
    return rows.map((row) => {
      const bank = row.bankAccount ?? {};
      const accountIdentifier = bank.accountNumber || bank.iban;
      let readinessReason: PayrollBankTransferRow['readinessReason'] = 'READY';
      if (row.netSalary === null || row.netSalary === undefined) readinessReason = 'MISSING_NET_SALARY';
      if (!bank.bankName) readinessReason = 'MISSING_BANK_NAME';
      if (!accountIdentifier) readinessReason = 'MISSING_ACCOUNT_IDENTIFIER';

      return {
        employeeId: row.employeeId,
        workerId: row.workerId,
        name: row.name,
        workEmail: row.email,
        bankName: bank.bankName ?? '',
        accountHolderName: bank.accountHolderName ?? row.name,
        accountNumber: bank.accountNumber ?? '',
        iban: bank.iban ?? '',
        routingNumber: bank.routingNumber ?? '',
        swiftCode: bank.swiftCode ?? '',
        netSalary: row.netSalary,
        currency: row.currency,
        bankReady: readinessReason === 'READY',
        readinessReason,
      };
    });
  }

  buildResultLineDrafts(row: PayrollCycleRow, ids: { payrollCycleId: string; calculationRunId: string }): PayrollResultLineDraft[] {
    const snapshotHash = hashSnapshot({
      workerId: row.workerId,
      employeeId: row.employeeId,
      employmentType: row.employmentType,
      salaryBasis: row.salaryBasis,
      department: row.department,
      workLocationCode: row.workLocationCode,
      baseGrossSalary: row.baseGrossSalary,
      earningAmount: row.earningAmount,
      taxableEarningAmount: row.taxableEarningAmount,
      nonTaxableEarningAmount: row.nonTaxableEarningAmount,
      grossSalary: row.grossSalary,
      taxAmount: row.taxAmount,
      employeeInsuranceAmount: row.employeeInsuranceAmount,
      employerInsuranceAmount: row.employerInsuranceAmount,
      policyDeductionAmount: row.policyDeductionAmount,
      netSalary: row.netSalary,
      currency: row.currency,
      taxIdentifier: row.taxIdentifier,
      insuranceIdentifier: row.insuranceIdentifier,
      policyAssignmentWarnings: row.policyAssignmentWarnings,
      attendanceSummary: row.attendanceSummary,
      explainability: row.explainability,
    });

    const drafts: PayrollResultLineDraft[] = row.explainability.map((line) => ({
      workerId: row.workerId,
      payrollCycleId: ids.payrollCycleId,
      calculationRunId: ids.calculationRunId,
      lineType: line.code,
      description: line.label,
      amount: line.amount,
      currency: row.currency,
      ruleSetId: line.source,
      ruleId: line.code,
      calculationStep: line.source,
      inputSnapshotHash: snapshotHash,
      explanation: line.formula,
    }));

    if (row.netSalary !== null) {
      drafts.push({
        workerId: row.workerId,
        payrollCycleId: ids.payrollCycleId,
        calculationRunId: ids.calculationRunId,
        lineType: 'NET_PAY',
        description: 'Net pay',
        amount: row.netSalary,
        currency: row.currency,
        ruleSetId: 'SYSTEM',
        ruleId: 'NET_PAY',
        calculationStep: 'NET',
        inputSnapshotHash: snapshotHash,
        explanation: 'gross - tax - employee insurance - policy deductions',
      });
    }

    return drafts;
  }

  buildPayslipsFromResultLines(input: {
    payrollCycle: { id: string; periodStart: string; periodEnd: string; payDate: string };
    employees: PayrollCycleEmployeeInput[];
    resultLines: PayrollPayslipLine[];
  }): PayrollPayslip[] {
    const employeeByWorkerId = new Map(input.employees.map((employee) => [employee.workerId, employee]));
    const grouped = new Map<string, PayrollPayslipLine[]>();
    for (const line of input.resultLines) {
      grouped.set(line.workerId, [...(grouped.get(line.workerId) ?? []), line]);
    }

    return [...grouped.entries()].map(([workerId, lines]) => {
      const employee = employeeByWorkerId.get(workerId);
      const grossPay = roundMoney(lines
        .filter((line) => line.lineType === 'GROSS' || line.ruleSetId === 'EARNING')
        .reduce((total, line) => total + line.amount, 0));
      const taxes = this.sumLineTypes(lines, ['TAX']);
      const employerOnly = new Set(['EMPLOYER_INSURANCE', 'GROSS', 'TAX', 'NET_PAY']);
      const deductions = roundMoney(lines
        .filter((line) => !employerOnly.has(line.lineType) && line.ruleSetId !== 'EARNING')
        .reduce((total, line) => total + line.amount, 0));
      const explicitNet = lines.find((line) => line.lineType === 'NET_PAY')?.amount;
      const netPay = explicitNet ?? roundMoney(Math.max(grossPay - taxes - deductions, 0));

      return {
        id: `${input.payrollCycle.id}:${workerId}`,
        workerId,
        employeeId: employee?.employeeId ?? workerId,
        employeeName: employee?.name ?? workerId,
        payPeriodStart: input.payrollCycle.periodStart,
        payPeriodEnd: input.payrollCycle.periodEnd,
        payDate: input.payrollCycle.payDate,
        grossPay,
        netPay,
        deductions,
        taxes,
        currency: lines[0]?.currency ?? employee?.currency ?? 'EGP',
        lines,
      };
    });
  }

  maskRowForActor(row: PayrollCycleRow, actor: PayrollActorVisibility): PayrollCycleRow {
    if (canSeeSalary(actor, row.workerId)) return row;

    return {
      ...row,
      baseGrossSalary: null,
      earningAmount: null,
      taxableEarningAmount: null,
      nonTaxableEarningAmount: null,
      grossSalary: null,
      taxAmount: null,
      employeeInsuranceAmount: null,
      employerInsuranceAmount: null,
      policyDeductionAmount: null,
      netSalary: null,
      explainability: [],
    };
  }

  private sumLineTypes(lines: PayrollPayslipLine[], lineTypes: string[]): number {
    const allowed = new Set(lineTypes);
    return roundMoney(lines
      .filter((line) => allowed.has(line.lineType))
      .reduce((total, line) => total + line.amount, 0));
  }
}
