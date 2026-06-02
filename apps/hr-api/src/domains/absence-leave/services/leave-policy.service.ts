import { Injectable } from '@nestjs/common';
import { ValidationError } from '@hcm/shared-kernel';
import type { AttendanceHolidayRule, HcmSetupConfig, LeavePolicy } from '../../hcm-setup/hcm-setup.types.js';

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
}
