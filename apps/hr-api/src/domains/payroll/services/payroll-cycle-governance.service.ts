import { Injectable } from '@nestjs/common';
import type {
  HcmSetupConfig,
  PayrollBlockingCondition,
  PayrollBlockingRule,
  PayrollGlAccountMapping,
  StatutoryPayrollPack,
} from '../../hcm-setup/hcm-setup.types.js';
import type { PayrollBankTransferRow, PayrollCyclePreview, PayrollCycleRow } from './payroll-cycle-calculation.service.js';

export type PayrollReadinessSeverity = 'ERROR' | 'WARNING';

export interface ExistingPayrollCycleSummary {
  payrollCycleId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  workLocationCode?: string;
}

export interface PayrollReadinessIssue {
  code: string;
  condition?: PayrollBlockingCondition;
  severity: PayrollReadinessSeverity;
  blocking: boolean;
  message: string;
  employeeId?: string;
  workerId?: string;
  payrollCycleId?: string;
}

export interface PayrollCloseToPayReadiness {
  canClose: boolean;
  blockingIssueCount: number;
  warningIssueCount: number;
  issues: PayrollReadinessIssue[];
}

type PayrollGovernanceSetup = Partial<Pick<
  HcmSetupConfig,
  'countryPolicyRuntime' | 'locations' | 'payrollBlockingRules' | 'statutoryPayrollPacks'
>>;

export interface PayrollCloseGlPostingEvidence {
  status?: string;
  totalDebits?: number;
  totalCredits?: number;
  lineCount?: number;
}

export interface PayrollClosePaymentBatchEvidence {
  status?: string;
  readyCount?: number;
  blockedCount?: number;
  totalNet?: number;
  exceptionCount?: number;
}

export interface PayrollClosePayslipArtifactEvidence {
  workerId: string;
  employeeId?: string;
  status?: string;
  contentHash?: string;
  htmlReady?: boolean;
}

export interface PayrollEnterpriseCloseEvidence {
  requireEnterpriseEvidence?: boolean;
  glMappingReady?: boolean;
  paymentBatchConfigReady?: boolean;
  glPosting?: PayrollCloseGlPostingEvidence;
  paymentBatch?: PayrollClosePaymentBatchEvidence;
  payslipArtifacts?: PayrollClosePayslipArtifactEvidence[];
  expectedPayslipWorkerIds?: string[];
}

export interface PayrollCloseToPayReadinessInput {
  preview: PayrollCyclePreview;
  bankRows: PayrollBankTransferRow[];
  existingCycles?: ExistingPayrollCycleSummary[];
  workLocationCode?: string;
  setup?: PayrollGovernanceSetup;
  closeEvidence?: PayrollEnterpriseCloseEvidence;
}

type AttendanceSummaryWithBlockers = NonNullable<PayrollCycleRow['attendanceSummary']> & {
  payrollBlockers?: string[];
};

function isActiveDuplicate(
  existing: ExistingPayrollCycleSummary,
  preview: PayrollCyclePreview,
  workLocationCode?: string,
): boolean {
  if (existing.status === 'CANCELLED') return false;
  if (existing.periodStart !== preview.periodStart || existing.periodEnd !== preview.periodEnd) return false;
  if (workLocationCode && existing.workLocationCode && existing.workLocationCode !== workLocationCode) return false;
  return true;
}

const DEFAULT_PAYROLL_BLOCKING_RULES: PayrollBlockingRule[] = [
  {
    code: 'DUPLICATE_PAYROLL_CYCLE',
    label: 'Duplicate payroll cycle',
    active: true,
    condition: 'DUPLICATE_PAYROLL_CYCLE',
    severity: 'ERROR',
    blocking: true,
  },
  {
    code: 'MISSING_BANK_ACCOUNT',
    label: 'Missing bank account',
    active: true,
    condition: 'MISSING_BANK_ACCOUNT',
    severity: 'ERROR',
    blocking: true,
  },
  {
    code: 'MISSING_PAYROLL_COMPENSATION',
    label: 'Missing payroll compensation',
    active: true,
    condition: 'MISSING_PAYROLL_COMPENSATION',
    severity: 'ERROR',
    blocking: true,
  },
  {
    code: 'ATTENDANCE_BLOCKER',
    label: 'Unresolved attendance blocker',
    active: true,
    condition: 'ATTENDANCE_BLOCKER',
    severity: 'ERROR',
    blocking: true,
  },
  {
    code: 'ZERO_OR_NEGATIVE_NET_PAY',
    label: 'Zero or negative net pay',
    active: true,
    condition: 'ZERO_OR_NEGATIVE_NET_PAY',
    severity: 'ERROR',
    blocking: true,
  },
];

function matchesOptionalList(values: string[] | undefined, candidate: string | undefined): boolean {
  return !values?.length || Boolean(candidate && values.includes(candidate));
}

function ruleTargetsRow(rule: PayrollBlockingRule, row: PayrollCycleRow): boolean {
  return matchesOptionalList(rule.workerIds, row.workerId)
    && matchesOptionalList(rule.employeeIds, row.employeeId)
    && matchesOptionalList(rule.employeeTypes, row.employmentType ?? row.salaryBasis)
    && matchesOptionalList(rule.departmentCodes, row.department)
    && matchesOptionalList(rule.locationCodes, row.workLocationCode);
}

function ruleTargetsCycle(rule: PayrollBlockingRule, workLocationCode?: string): boolean {
  return matchesOptionalList(rule.locationCodes, workLocationCode);
}

function dateIsAfter(value: string | undefined, reference: string): boolean {
  if (!value) return false;
  return new Date(`${value}T23:59:59.999Z`).getTime() < new Date(`${reference}T00:00:00.000Z`).getTime();
}

function runtimeString(runtime: Record<string, unknown>, key: string): string | undefined {
  const value = runtime[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function runtimeBoolean(runtime: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = runtime[key];
  return typeof value === 'boolean' ? value : fallback;
}

const REQUIRED_GL_MAPPING_KEYS: Array<keyof PayrollGlAccountMapping> = [
  'salaryExpenseAccount',
  'employerInsuranceExpenseAccount',
  'taxPayableAccount',
  'insurancePayableAccount',
  'deductionPayableAccount',
  'bankClearingAccount',
];

function hasCompleteGlMapping(mapping: PayrollGlAccountMapping | undefined): boolean {
  return Boolean(mapping && REQUIRED_GL_MAPPING_KEYS.every((key) => {
    const value = mapping[key];
    return typeof value === 'string' && value.trim().length > 0;
  }));
}

function applicableCountryCodes(input: PayrollCloseToPayReadinessInput): Set<string> {
  const codes = new Set<string>();
  const runtime = (input.setup?.countryPolicyRuntime ?? {}) as Record<string, unknown>;
  const runtimeCountryCode = runtimeString(runtime, 'countryCode');
  if (runtimeCountryCode) codes.add(runtimeCountryCode);

  const locationCodes = new Set([
    input.workLocationCode,
    ...input.preview.rows.map((row) => row.workLocationCode),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0));

  for (const location of input.setup?.locations ?? []) {
    if (locationCodes.size > 0 && !locationCodes.has(location.code)) continue;
    if (location.countryCode) codes.add(location.countryCode);
  }

  return codes;
}

function periodApplies(pack: StatutoryPayrollPack, preview: PayrollCyclePreview): boolean {
  if (dateIsAfter(pack.effectiveUntil, preview.periodEnd)) return false;
  if (pack.effectiveFrom && new Date(`${pack.effectiveFrom}T00:00:00.000Z`).getTime() > new Date(`${preview.periodEnd}T23:59:59.999Z`).getTime()) {
    return false;
  }
  return true;
}

function findApplicableStatutoryPack(input: PayrollCloseToPayReadinessInput): StatutoryPayrollPack | undefined {
  const activePacks = (input.setup?.statutoryPayrollPacks ?? []).filter((pack) => pack.active && periodApplies(pack, input.preview));
  const locationCodes = new Set([
    input.workLocationCode,
    ...input.preview.rows.map((row) => row.workLocationCode),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0));
  const countryCodes = applicableCountryCodes(input);

  const locationPack = activePacks.find((pack) => (pack.locationCodes ?? []).some((code) => locationCodes.has(code)));
  if (locationPack) return locationPack;

  return activePacks.find((pack) => countryCodes.size === 0 || countryCodes.has(pack.countryCode));
}

function enterpriseIssue(
  code: string,
  message: string,
  extra: Pick<PayrollReadinessIssue, 'employeeId' | 'workerId' | 'payrollCycleId'> = {},
): PayrollReadinessIssue {
  return {
    ...extra,
    code,
    severity: 'ERROR',
    blocking: true,
    message,
  };
}

function paymentBatchExceptionCount(paymentBatch: PayrollClosePaymentBatchEvidence): number {
  return Number(paymentBatch.exceptionCount ?? 0);
}

function glPostingIsBalanced(glPosting: PayrollCloseGlPostingEvidence): boolean {
  const totalDebits = Number(glPosting.totalDebits ?? 0);
  const totalCredits = Number(glPosting.totalCredits ?? 0);
  return Number(glPosting.lineCount ?? 0) > 0 && Math.abs(totalDebits - totalCredits) <= 0.01;
}

function payslipArtifactReady(artifact: PayrollClosePayslipArtifactEvidence): boolean {
  return ['GENERATED', 'PUBLISHED'].includes(String(artifact.status))
    && typeof artifact.contentHash === 'string'
    && artifact.contentHash.trim().length > 0
    && artifact.htmlReady !== false;
}

function appendEnterpriseCloseIssues(input: PayrollCloseToPayReadinessInput, issues: PayrollReadinessIssue[]): void {
  const closeEvidence = input.closeEvidence;
  if (!closeEvidence?.requireEnterpriseEvidence) return;

  const applicablePack = findApplicableStatutoryPack(input);
  const glMappingReady = closeEvidence.glMappingReady ?? hasCompleteGlMapping(applicablePack?.glAccountMapping);
  if (!glMappingReady) {
    issues.push(enterpriseIssue(
      'MISSING_GL_MAPPING',
      'Payroll close is blocked because the statutory payroll pack does not provide a complete GL account mapping.',
    ));
  }

  const paymentBatchConfigReady = closeEvidence.paymentBatchConfigReady ?? Boolean(applicablePack?.bankFileFormats?.length);
  if (!paymentBatchConfigReady) {
    issues.push(enterpriseIssue(
      'MISSING_PAYMENT_BATCH_CONFIG',
      'Payroll close is blocked because the statutory payroll pack does not configure at least one bank file format.',
    ));
  }

  if (!closeEvidence.glPosting) {
    issues.push(enterpriseIssue(
      'MISSING_GL_POSTING',
      'Payroll close is blocked because no persisted GL posting exists for this payroll cycle.',
    ));
  } else if (!glPostingIsBalanced(closeEvidence.glPosting)) {
    issues.push(enterpriseIssue(
      'GL_POSTING_UNBALANCED',
      'Payroll close is blocked because the persisted GL posting is missing lines or does not balance debits and credits.',
    ));
  }

  const paymentBatch = closeEvidence.paymentBatch;
  if (!paymentBatch) {
    issues.push(enterpriseIssue(
      'MISSING_PAYMENT_BATCH',
      'Payroll close is blocked because no persisted payment batch exists for this payroll cycle.',
    ));
  } else if (paymentBatch.status === 'RECONCILIATION_EXCEPTION' || paymentBatchExceptionCount(paymentBatch) > 0) {
    issues.push(enterpriseIssue(
      'UNRESOLVED_PAYROLL_EXCEPTION',
      'Payroll close is blocked because the payment batch has unresolved payroll or bank reconciliation exceptions.',
    ));
  } else if (
    !['READY', 'APPROVED', 'EXPORTED', 'RECONCILED'].includes(String(paymentBatch.status))
    || Number(paymentBatch.blockedCount ?? 0) > 0
    || Number(paymentBatch.readyCount ?? 0) <= 0
  ) {
    issues.push(enterpriseIssue(
      'PAYMENT_BATCH_NOT_READY',
      'Payroll close is blocked because the payment batch is not ready for payment processing.',
    ));
  }

  const artifactsByWorkerId = new Map((closeEvidence.payslipArtifacts ?? []).map((artifact) => [artifact.workerId, artifact]));
  const expectedWorkerIds = closeEvidence.expectedPayslipWorkerIds?.length
    ? closeEvidence.expectedPayslipWorkerIds
    : input.preview.rows.map((row) => row.workerId);
  for (const workerId of expectedWorkerIds) {
    const artifact = artifactsByWorkerId.get(workerId);
    if (!artifact) {
      const row = input.preview.rows.find((item) => item.workerId === workerId);
      issues.push(enterpriseIssue(
        'MISSING_PAYSLIP_ARTIFACT',
        `Payroll close is blocked because employee ${row?.employeeId ?? workerId} has no generated payslip artifact.`,
        { workerId, employeeId: row?.employeeId },
      ));
      continue;
    }
    if (!payslipArtifactReady(artifact)) {
      issues.push(enterpriseIssue(
        'PAYSLIP_ARTIFACT_NOT_READY',
        `Payroll close is blocked because employee ${artifact.employeeId ?? workerId} has a payslip artifact that is not ready.`,
        { workerId, employeeId: artifact.employeeId },
      ));
    }
  }
}

function issueFromRule(
  rule: PayrollBlockingRule,
  input: Omit<PayrollReadinessIssue, 'code' | 'condition' | 'severity' | 'blocking' | 'message'> & { message?: string },
): PayrollReadinessIssue {
  return {
    ...input,
    code: rule.code,
    condition: rule.condition,
    severity: rule.severity,
    blocking: rule.blocking,
    message: rule.message ?? input.message ?? rule.label,
  };
}

@Injectable()
export class PayrollCycleGovernanceService {
  evaluateCloseToPayReadiness(input: PayrollCloseToPayReadinessInput): PayrollCloseToPayReadiness {
    const issues: PayrollReadinessIssue[] = [];
    const bankByWorkerId = new Map(input.bankRows.map((row) => [row.workerId, row]));
    const rules = input.setup?.payrollBlockingRules ?? DEFAULT_PAYROLL_BLOCKING_RULES;
    const activeRules = rules.filter((rule) => rule.active);
    const rulesFor = (condition: PayrollBlockingCondition) => activeRules.filter((rule) => rule.condition === condition);

    const countryRuntime = (input.setup?.countryPolicyRuntime ?? {}) as Record<string, unknown>;
    const countryCode = runtimeString(countryRuntime, 'countryCode');
    const packVersion = runtimeString(countryRuntime, 'packVersion');
    const runtimeEffectiveUntil = runtimeString(countryRuntime, 'effectiveUntil');
    const countryPolicyBlocksPayroll = runtimeBoolean(countryRuntime, 'blocksPayrollIfStale', true);
    const activeStatutoryPackExists = Boolean(countryCode && input.setup?.statutoryPayrollPacks?.some((pack) => (
      pack.active
      && pack.countryCode === countryCode
      && matchesOptionalList(pack.locationCodes, input.workLocationCode)
      && !dateIsAfter(pack.effectiveUntil, input.preview.periodEnd)
      && (!pack.effectiveFrom || new Date(`${pack.effectiveFrom}T00:00:00.000Z`).getTime() <= new Date(`${input.preview.periodEnd}T00:00:00.000Z`).getTime())
    )));

    for (const rule of rulesFor('DUPLICATE_PAYROLL_CYCLE')) {
      if (!ruleTargetsCycle(rule, input.workLocationCode)) continue;
      for (const existing of input.existingCycles ?? []) {
        if (!isActiveDuplicate(existing, input.preview, input.workLocationCode)) continue;
        issues.push(issueFromRule(rule, {
          payrollCycleId: existing.payrollCycleId,
          message: `Payroll cycle ${existing.payrollCycleId} already covers ${input.preview.periodStart} to ${input.preview.periodEnd}.`,
        }));
      }
    }

    if (countryPolicyBlocksPayroll) {
      for (const rule of rulesFor('COUNTRY_POLICY_STALE')) {
        if (!ruleTargetsCycle(rule, input.workLocationCode)) continue;
        if (countryCode && packVersion && !dateIsAfter(runtimeEffectiveUntil, input.preview.periodEnd) && activeStatutoryPackExists) continue;
        issues.push(issueFromRule(rule, {
          message: `Payroll close is blocked because the country statutory policy for ${countryCode ?? 'this payroll scope'} is missing, stale, or lacks an active statutory payroll pack.`,
        }));
      }
    }

    for (const row of input.preview.rows) {
      const bankRow = bankByWorkerId.get(row.workerId);
      for (const rule of rulesFor('MISSING_BANK_ACCOUNT')) {
        if (!ruleTargetsRow(rule, row) || bankRow?.bankReady) continue;
        issues.push(issueFromRule(rule, {
          employeeId: row.employeeId,
          workerId: row.workerId,
          message: `Employee ${row.employeeId} is missing a payroll-ready bank account.`,
        }));
      }

      for (const rule of rulesFor('MISSING_PAYROLL_COMPENSATION')) {
        if (!ruleTargetsRow(rule, row) || (row.grossSalary ?? 0) > 0) continue;
        issues.push(issueFromRule(rule, {
          employeeId: row.employeeId,
          workerId: row.workerId,
          message: `Employee ${row.employeeId} has no positive gross payroll compensation.`,
        }));
      }

      const blockers = ((row.attendanceSummary ?? {}) as AttendanceSummaryWithBlockers).payrollBlockers ?? [];
      for (const rule of rulesFor('ATTENDANCE_BLOCKER')) {
        if (!ruleTargetsRow(rule, row)) continue;
        for (const blocker of blockers) {
          issues.push(issueFromRule(rule, {
            employeeId: row.employeeId,
            workerId: row.workerId,
            message: `Employee ${row.employeeId} has unresolved attendance blocker: ${blocker}.`,
          }));
        }
      }

      for (const rule of rulesFor('ZERO_OR_NEGATIVE_NET_PAY')) {
        if (!ruleTargetsRow(rule, row) || (row.netSalary ?? 0) > 0) continue;
        issues.push(issueFromRule(rule, {
          employeeId: row.employeeId,
          workerId: row.workerId,
          message: `Employee ${row.employeeId} has zero or negative net pay and must be reviewed.`,
        }));
      }

      for (const rule of rulesFor('MISSING_TAX_IDENTIFIER')) {
        if (!ruleTargetsRow(rule, row) || row.taxIdentifier) continue;
        issues.push(issueFromRule(rule, {
          employeeId: row.employeeId,
          workerId: row.workerId,
          message: `Employee ${row.employeeId} is missing a payroll tax identifier.`,
        }));
      }

      for (const rule of rulesFor('MISSING_POLICY_ASSIGNMENT')) {
        if (!ruleTargetsRow(rule, row)) continue;
        for (const warning of row.policyAssignmentWarnings ?? []) {
          issues.push(issueFromRule(rule, {
            employeeId: row.employeeId,
            workerId: row.workerId,
            message: `Employee ${row.employeeId} policy assignment warning: ${warning}.`,
          }));
        }
      }

      for (const rule of rulesFor('NET_BELOW_MINIMUM')) {
        const minimumNetSalary = rule.minNetSalary ?? 0;
        if (!ruleTargetsRow(rule, row) || (row.netSalary ?? 0) >= minimumNetSalary) continue;
        issues.push(issueFromRule(rule, {
          employeeId: row.employeeId,
          workerId: row.workerId,
          message: `Employee ${row.employeeId} net pay is below the configured minimum of ${minimumNetSalary}.`,
        }));
      }
    }

    appendEnterpriseCloseIssues(input, issues);

    const blockingIssueCount = issues.filter((item) => item.blocking).length;
    return {
      canClose: blockingIssueCount === 0,
      blockingIssueCount,
      warningIssueCount: issues.filter((item) => !item.blocking).length,
      issues,
    };
  }
}
