import { Injectable } from '@nestjs/common';
import type { HcmSetupConfig, PayrollBlockingCondition, PayrollBlockingRule } from '../../hcm-setup/hcm-setup.types.js';
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

export interface PayrollCloseToPayReadinessInput {
  preview: PayrollCyclePreview;
  bankRows: PayrollBankTransferRow[];
  existingCycles?: ExistingPayrollCycleSummary[];
  workLocationCode?: string;
  setup?: Pick<HcmSetupConfig, 'payrollBlockingRules'>;
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

    const blockingIssueCount = issues.filter((item) => item.blocking).length;
    return {
      canClose: blockingIssueCount === 0,
      blockingIssueCount,
      warningIssueCount: issues.filter((item) => !item.blocking).length,
      issues,
    };
  }
}
