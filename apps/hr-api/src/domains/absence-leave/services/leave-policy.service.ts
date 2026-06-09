import { Injectable } from '@nestjs/common';
import { ValidationError } from '@hcm/shared-kernel';
import type {
  AttendanceHolidayRule,
  HcmSetupConfig,
  LeaveApprovalWorkflow,
  LeavePolicy,
  PolicyRuleCondition,
  PolicyRuleLedger,
  PolicyRuleOutcome,
} from '../../hcm-setup/hcm-setup.types.js';

export interface LeaveDurationInput {
  absenceType: string;
  startDate: Date;
  endDate: Date;
  startTime?: string;
  endTime?: string;
  countryCode?: string;
  workplaceCode?: string;
}

export interface LeaveDurationResult {
  policy: LeavePolicy;
  durationUnit: LeavePolicy['unit'];
  durationAmount: number;
  calendarDays: number;
  workingDays: number;
  excludedHolidayDates: string[];
  paid: boolean;
  deductFromBalance: boolean;
  payrollImpact: LeavePolicy['payrollImpact'];
}

export interface LeaveBalancePolicyResult {
  allowed: boolean;
  requestedAmount: number;
  availableAmount?: number;
  reason?: string;
}

export interface LeaveApprovalDecision {
  policyCode: string;
  approvalWorkflow: LeaveApprovalWorkflow;
  requiresDocument: boolean;
  requiredDocumentCodes: string[];
  matchedRuleCodes: string[];
  reasons: string[];
}

export interface LeavePeriodUsageRequest {
  absenceType: string;
  policyCode?: string;
  startDate: Date;
  endDate: Date;
  durationUnit: LeavePolicy['unit'];
  durationAmount: number;
  payrollImpact?: LeavePolicy['payrollImpact'];
  status: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function asUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function calendarDaysInclusive(startDate: Date, endDate: Date): number {
  const start = asUtcDate(dateKey(startDate)).getTime();
  const end = asUtcDate(dateKey(endDate)).getTime();
  return Math.floor((end - start) / 86400000) + 1;
}

function startOfCalendarWeek(value: Date): Date {
  const date = asUtcDate(dateKey(value));
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(date, mondayOffset);
}

function startOfCalendarMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function endOfCalendarMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function overlaps(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date): boolean {
  return asUtcDate(dateKey(leftStart)).getTime() <= asUtcDate(dateKey(rightEnd)).getTime()
    && asUtcDate(dateKey(leftEnd)).getTime() >= asUtcDate(dateKey(rightStart)).getTime();
}

function parseTimeToMinutes(value: string): number {
  if (!TIME_PATTERN.test(value)) {
    throw new ValidationError(`Invalid time ${value}. Use HH:mm.`);
  }
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function normalizeHolidays(setup: HcmSetupConfig): AttendanceHolidayRule[] {
  return [
    ...(setup.attendancePolicy.holidayCalendars ?? []),
    ...(setup.attendancePolicy.holidays ?? []).map((holiday) => ({ ...holiday })),
  ];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function effectiveOn(rule: PolicyRuleLedger, date?: Date): boolean {
  if (!date) return true;
  const target = asUtcDate(dateKey(date)).getTime();
  if (rule.effectiveFrom && asUtcDate(rule.effectiveFrom).getTime() > target) return false;
  if (rule.effectiveUntil && asUtcDate(rule.effectiveUntil).getTime() < target) return false;
  return true;
}

function conditionMatches(condition: PolicyRuleCondition, context: Record<string, unknown>): boolean {
  const actual = condition.field ? context[condition.field] : undefined;
  const operator = condition.operator ?? 'EXISTS';
  const expected = condition.value;

  if (operator === 'EXISTS') return actual !== undefined && actual !== null && actual !== '';
  if (operator === 'EQUALS') return actual === expected;
  if (operator === 'NOT_EQUALS') return actual !== expected;
  if (operator === 'IN') {
    const expectedValues = Array.isArray(expected) ? expected : [expected];
    return Array.isArray(actual)
      ? actual.some((item) => expectedValues.includes(item))
      : expectedValues.includes(actual);
  }
  if (operator === 'NOT_IN') {
    const expectedValues = Array.isArray(expected) ? expected : [expected];
    return Array.isArray(actual)
      ? actual.every((item) => !expectedValues.includes(item))
      : !expectedValues.includes(actual);
  }

  const actualNumber = typeof actual === 'number' ? actual : Number(actual);
  const expectedNumber = typeof expected === 'number' ? expected : Number(expected);
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;

  if (operator === 'GT') return actualNumber > expectedNumber;
  if (operator === 'GTE') return actualNumber >= expectedNumber;
  if (operator === 'LT') return actualNumber < expectedNumber;
  if (operator === 'LTE') return actualNumber <= expectedNumber;
  return false;
}

function ruleMatches(rule: PolicyRuleLedger, context: Record<string, unknown>, effectiveDate?: Date): boolean {
  if (!rule.active || !effectiveOn(rule, effectiveDate)) return false;
  return (rule.conditions ?? []).every((condition) => conditionMatches(condition, context));
}

function workflowFromOutcome(outcome: PolicyRuleOutcome): LeaveApprovalWorkflow | undefined {
  const value = asRecord(outcome.value);
  const workflow = value.workflow ?? value.approvalWorkflow;
  return workflow === 'MANAGER'
    || workflow === 'MANAGER_THEN_HR'
    || workflow === 'HR_ONLY'
    || workflow === 'AUTO_APPROVE'
    ? workflow
    : undefined;
}

function documentCodeFromOutcome(outcome: PolicyRuleOutcome): string {
  const value = asRecord(outcome.value);
  return typeof value.documentCode === 'string' && value.documentCode.trim()
    ? value.documentCode.trim()
    : 'SUPPORTING_DOCUMENT';
}

function holidayMatches(
  holiday: AttendanceHolidayRule,
  input: { countryCode?: string; workplaceCode?: string },
): boolean {
  const locationMatches = input.workplaceCode && holiday.locationCodes?.includes(input.workplaceCode);
  const countryMatches = input.countryCode && holiday.countryCode === input.countryCode;
  const globalHoliday = !holiday.countryCode && (!holiday.locationCodes || holiday.locationCodes.length === 0);
  return Boolean(locationMatches || countryMatches || globalHoliday || (!input.countryCode && !input.workplaceCode));
}

@Injectable()
export class LeavePolicyService {
  resolvePolicy(setup: Pick<HcmSetupConfig, 'leavePolicies'>, absenceType: string): LeavePolicy {
    const normalized = normalizeCode(absenceType);
    const policy = (setup.leavePolicies ?? []).find((candidate) => (
      candidate.active
      && (normalizeCode(candidate.code) === normalized || normalizeCode(candidate.label) === normalized)
    ));
    if (!policy) {
      throw new ValidationError(`Leave policy ${absenceType} is not active or does not exist`);
    }
    return policy;
  }

  calculateDuration(setup: HcmSetupConfig, input: LeaveDurationInput): LeaveDurationResult {
    if (input.startDate.getTime() > input.endDate.getTime()) {
      throw new ValidationError('Leave start date must be before end date');
    }

    const policy = this.resolvePolicy(setup, input.absenceType);
    this.assertMinimumNotice(policy, input.startDate);
    const calendarDays = calendarDaysInclusive(input.startDate, input.endDate);
    const working = this.countWorkingDays(setup, input);

    if (policy.unit === 'HOURS') {
      if (!input.startTime || !input.endTime) {
        throw new ValidationError(`${policy.label} is an hourly leave policy and requires start and end time`);
      }
      if (dateKey(input.startDate) !== dateKey(input.endDate)) {
        throw new ValidationError(`${policy.label} must be requested within one calendar day`);
      }
      const minutes = parseTimeToMinutes(input.endTime) - parseTimeToMinutes(input.startTime);
      if (minutes <= 0) throw new ValidationError('Hourly leave end time must be after start time');
      const durationAmount = Math.round((minutes / 60) * 100) / 100;
      this.assertPolicyLimits(policy, durationAmount);
      return {
        policy,
        durationUnit: 'HOURS',
        durationAmount,
        calendarDays,
        workingDays: working.workingDays,
        excludedHolidayDates: working.excludedHolidayDates,
        paid: policy.paid,
        deductFromBalance: policy.deductFromBalance,
        payrollImpact: policy.payrollImpact,
      };
    }

    const durationAmount = working.workingDays;
    if (durationAmount <= 0) {
      throw new ValidationError('Leave request does not include any scheduled working day');
    }
    this.assertPolicyLimits(policy, durationAmount);
    return {
      policy,
      durationUnit: 'DAYS',
      durationAmount,
      calendarDays,
      workingDays: durationAmount,
      excludedHolidayDates: working.excludedHolidayDates,
      paid: policy.paid,
      deductFromBalance: policy.deductFromBalance,
      payrollImpact: policy.payrollImpact,
    };
  }

  amountToStoredHours(setup: HcmSetupConfig, durationUnit: LeavePolicy['unit'], durationAmount: number): number {
    if (durationUnit === 'HOURS') return durationAmount;
    return durationAmount * ((setup.attendancePolicy.standardDailyMinutes || 480) / 60);
  }

  amountFromStoredHours(setup: HcmSetupConfig, policy: LeavePolicy, storedHours: number): number {
    if (policy.unit === 'HOURS') return storedHours;
    const standardDailyHours = (setup.attendancePolicy.standardDailyMinutes || 480) / 60;
    return Math.round((storedHours / standardDailyHours) * 100) / 100;
  }

  checkBalance(
    setup: HcmSetupConfig,
    duration: LeaveDurationResult,
    balanceHours?: number,
  ): LeaveBalancePolicyResult {
    const requestedHours = this.amountToStoredHours(setup, duration.durationUnit, duration.durationAmount);
    const requestedAmount = this.amountFromStoredHours(setup, duration.policy, requestedHours);

    if (!duration.deductFromBalance) {
      return { allowed: true, requestedAmount };
    }

    const availableHours = balanceHours ?? (
      duration.policy.annualEntitlement !== undefined
        ? this.amountToStoredHours(setup, duration.policy.unit, duration.policy.annualEntitlement)
        : undefined
    );

    if (availableHours === undefined) {
      return { allowed: true, requestedAmount };
    }

    const availableAmount = this.amountFromStoredHours(setup, duration.policy, availableHours);
    if (requestedHours > availableHours + 0.0001) {
      return {
        allowed: false,
        requestedAmount,
        availableAmount,
        reason: `${duration.policy.label} exceeds available balance of ${availableAmount} ${duration.policy.unit.toLowerCase()}`,
      };
    }

    return { allowed: true, requestedAmount, availableAmount };
  }

  assertBalanceAvailable(setup: HcmSetupConfig, duration: LeaveDurationResult, balanceHours?: number): void {
    const result = this.checkBalance(setup, duration, balanceHours);
    if (!result.allowed) {
      throw new ValidationError(result.reason ?? `${duration.policy.label} exceeds available balance`);
    }
  }

  resolveApprovalDecision(
    duration: LeaveDurationResult,
    context: { startDate?: Date; absenceType?: string } = {},
  ): LeaveApprovalDecision {
    let approvalWorkflow = duration.policy.approvalWorkflow;
    const requiredDocumentCodes: string[] = [];
    const matchedRuleCodes: string[] = [];
    const reasons: string[] = [];
    const decisionContext = {
      absenceType: context.absenceType ?? duration.policy.code,
      policyCode: duration.policy.code,
      durationAmount: duration.durationAmount,
      durationUnit: duration.durationUnit,
      payrollImpact: duration.payrollImpact,
      calendarDays: duration.calendarDays,
      workingDays: duration.workingDays,
      paid: duration.paid,
      deductFromBalance: duration.deductFromBalance,
    };

    if (duration.policy.requiresDocumentAfter !== undefined && duration.durationAmount > duration.policy.requiresDocumentAfter) {
      requiredDocumentCodes.push('SUPPORTING_DOCUMENT');
      reasons.push(`${duration.policy.label} requires supporting evidence after ${duration.policy.requiresDocumentAfter} ${duration.durationUnit.toLowerCase()}.`);
    }

    for (const rule of [...(duration.policy.approvalRules ?? []), ...(duration.policy.documentRules ?? [])]) {
      if (!ruleMatches(rule, decisionContext, context.startDate)) continue;
      matchedRuleCodes.push(rule.code);

      for (const outcome of rule.outcomes ?? []) {
        if (outcome.action === 'BLOCK') {
          throw new ValidationError(outcome.reason ?? `${rule.label} blocks this leave request`);
        }
        if (outcome.action === 'REQUIRE_APPROVAL') {
          approvalWorkflow = workflowFromOutcome(outcome) ?? approvalWorkflow;
        }
        if (outcome.action === 'REQUIRE_DOCUMENT') {
          requiredDocumentCodes.push(documentCodeFromOutcome(outcome));
        }
        if (outcome.reason) reasons.push(outcome.reason);
      }
    }

    return {
      policyCode: duration.policy.code,
      approvalWorkflow,
      requiresDocument: requiredDocumentCodes.length > 0,
      requiredDocumentCodes: uniqueSorted(requiredDocumentCodes),
      matchedRuleCodes: uniqueSorted(matchedRuleCodes),
      reasons: uniqueSorted(reasons),
    };
  }

  assertPeriodLimits(
    duration: LeaveDurationResult,
    existingRequests: LeavePeriodUsageRequest[],
    requestedStartDate: Date,
  ): void {
    const limits = (duration.policy.periodLimits ?? []).filter((limit) => (
      limit.active
      && (!limit.appliesToUnits?.length || limit.appliesToUnits.includes(duration.durationUnit))
      && (!limit.appliesToPayrollImpacts?.length || limit.appliesToPayrollImpacts.includes(duration.payrollImpact))
    ));
    if (limits.length === 0) return;

    for (const limit of limits) {
      const window = this.resolveLimitWindow(limit.window, requestedStartDate, limit.rollingDays);
      const statuses = limit.includeStatuses ?? ['PENDING_APPROVAL', 'APPROVED'];
      const matching = existingRequests.filter((request) => (
        statuses.includes(request.status as 'PENDING_APPROVAL' | 'APPROVED')
        && request.durationUnit === duration.durationUnit
        && (request.policyCode === duration.policy.code || normalizeCode(request.absenceType) === normalizeCode(duration.policy.code))
        && overlaps(request.startDate, request.endDate, window.startDate, window.endDate)
      ));
      const amountUsed = matching.reduce((total, request) => total + request.durationAmount, 0);
      const nextRequestCount = matching.length + 1;
      const nextAmount = Math.round((amountUsed + duration.durationAmount) * 100) / 100;

      if (limit.maxRequests !== undefined && nextRequestCount > limit.maxRequests) {
        throw new ValidationError(`${duration.policy.label} exceeds ${limit.label} of ${limit.maxRequests} requests`);
      }
      if (limit.maxAmount !== undefined && nextAmount > limit.maxAmount) {
        throw new ValidationError(`${duration.policy.label} exceeds ${limit.label} of ${limit.maxAmount} ${duration.durationUnit.toLowerCase()}`);
      }
    }
  }

  private countWorkingDays(
    setup: HcmSetupConfig,
    input: LeaveDurationInput,
  ): { workingDays: number; excludedHolidayDates: string[] } {
    const workDays = setup.attendancePolicy.workDays ?? [0, 1, 2, 3, 4];
    const holidays = normalizeHolidays(setup).filter((holiday) => holidayMatches(holiday, input));
    const holidayDates = new Set(holidays.map((holiday) => holiday.date));
    const excludedHolidayDates = new Set<string>();
    let workingDays = 0;

    for (let cursor = asUtcDate(dateKey(input.startDate)); cursor.getTime() <= asUtcDate(dateKey(input.endDate)).getTime(); cursor = addDays(cursor, 1)) {
      const key = dateKey(cursor);
      if (holidayDates.has(key)) {
        excludedHolidayDates.add(key);
        continue;
      }
      if (workDays.includes(cursor.getUTCDay())) {
        workingDays += 1;
      }
    }

    return { workingDays, excludedHolidayDates: [...excludedHolidayDates].sort() };
  }

  private assertPolicyLimits(policy: LeavePolicy, amount: number): void {
    if (policy.maxPerRequest !== undefined && amount > policy.maxPerRequest) {
      throw new ValidationError(`${policy.label} exceeds max per request of ${policy.maxPerRequest} ${policy.unit.toLowerCase()}`);
    }
  }

  private assertMinimumNotice(policy: LeavePolicy, startDate: Date): void {
    if (policy.minNoticeDays === undefined || policy.minNoticeDays <= 0) return;
    const today = asUtcDate(dateKey(new Date()));
    const requestedStart = asUtcDate(dateKey(startDate));
    const noticeDays = Math.floor((requestedStart.getTime() - today.getTime()) / 86400000);
    if (noticeDays < policy.minNoticeDays) {
      const earliestStartDate = dateKey(addDays(today, policy.minNoticeDays));
      throw new ValidationError(`${policy.label} requires at least ${policy.minNoticeDays} days notice. Earliest start date is ${earliestStartDate}`);
    }
  }

  private resolveLimitWindow(
    window: NonNullable<LeavePolicy['periodLimits']>[number]['window'],
    requestedStartDate: Date,
    rollingDays?: number,
  ): { startDate: Date; endDate: Date } {
    if (window === 'CALENDAR_WEEK') {
      const startDate = startOfCalendarWeek(requestedStartDate);
      return { startDate, endDate: addDays(startDate, 6) };
    }
    if (window === 'CALENDAR_MONTH') {
      return { startDate: startOfCalendarMonth(requestedStartDate), endDate: endOfCalendarMonth(requestedStartDate) };
    }
    const days = Math.max(rollingDays ?? 30, 1);
    return { startDate: addDays(asUtcDate(dateKey(requestedStartDate)), -(days - 1)), endDate: asUtcDate(dateKey(requestedStartDate)) };
  }
}
