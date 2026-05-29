import { Injectable } from '@nestjs/common';
import type {
  AttendanceFlexibleHoursRule,
  AttendanceHolidayRule,
  AttendancePolicy,
  AttendanceShiftRotationRule,
  HcmSetupConfig,
  WorkLocationOption,
} from '../../hcm-setup/hcm-setup.types.js';

export interface AttendancePolicyWorkerContext {
  workerId: string;
  departmentCode?: string;
  workplaceCode?: string;
}

export interface ActiveScheduleContext {
  id?: { value?: string } | string;
  scheduleType?: string;
  daysOfWeek?: string[];
  hoursPerDay?: number;
}

export interface ResolvedAttendanceWorkerDay {
  scheduled: boolean;
  scheduledDailyMinutes?: number;
  scheduledWorkDays?: number[];
  scheduleId?: string;
  scheduleLabel?: string;
  shiftCode?: string;
  shiftLabel?: string;
  holiday?: AttendanceHolidayRule;
  effectivePolicy: AttendancePolicy;
  evidence: {
    scheduleSource: 'INDIVIDUAL_SCHEDULE' | 'SHIFT_ROTATION' | 'TENANT_DEFAULT';
    holidayScope?: 'LOCATION' | 'COUNTRY' | 'GLOBAL';
    flexibleRuleCode?: string;
  };
}

const DAY_INDEX_BY_NAME: Record<string, number> = {
  SUNDAY: 0,
  SUN: 0,
  MONDAY: 1,
  MON: 1,
  TUESDAY: 2,
  TUE: 2,
  WEDNESDAY: 3,
  WED: 3,
  THURSDAY: 4,
  THU: 4,
  FRIDAY: 5,
  FRI: 5,
  SATURDAY: 6,
  SAT: 6,
};

function workDateToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayCodeToIndex(value: string): number | undefined {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;
  return DAY_INDEX_BY_NAME[value.trim().toUpperCase()];
}

function daysBetween(startDate: string, endDate: string): number {
  const start = workDateToUtc(startDate).getTime();
  const end = workDateToUtc(endDate).getTime();
  return Math.floor((end - start) / 86400000);
}

function cycleOffset(anchorDate: string, workDate: string, cycleDays: number): number {
  if (cycleDays <= 0) return 0;
  const offset = daysBetween(anchorDate, workDate) % cycleDays;
  return offset < 0 ? offset + cycleDays : offset;
}

function includesIfPresent(values: string[] | undefined, value: string | undefined): boolean {
  return !values || values.length === 0 || (value !== undefined && values.includes(value));
}

function targetedMatch(
  target: { departmentCodes?: string[]; locationCodes?: string[]; workerIds?: string[] },
  worker: AttendancePolicyWorkerContext,
): boolean {
  return includesIfPresent(target.workerIds, worker.workerId)
    && includesIfPresent(target.departmentCodes, worker.departmentCode)
    && includesIfPresent(target.locationCodes, worker.workplaceCode);
}

function targetSpecificity(target: { departmentCodes?: string[]; locationCodes?: string[]; workerIds?: string[] }): number {
  return (target.workerIds?.length ? 4 : 0) + (target.departmentCodes?.length ? 2 : 0) + (target.locationCodes?.length ? 1 : 0);
}

function normalizeLegacyHolidays(policy: AttendancePolicy): AttendanceHolidayRule[] {
  return [
    ...(policy.holidayCalendars ?? []),
    ...(policy.holidays ?? []).map((holiday) => ({ ...holiday })),
  ];
}

function locationForWorker(setup: HcmSetupConfig, worker: AttendancePolicyWorkerContext): WorkLocationOption | undefined {
  return setup.locations.find((location) => location.code === worker.workplaceCode);
}

function ruleSort<T extends { workerIds?: string[]; departmentCodes?: string[]; locationCodes?: string[] }>(left: T, right: T): number {
  return targetSpecificity(right) - targetSpecificity(left);
}

@Injectable()
export class AttendancePolicyResolutionService {
  resolveWorkerDay(input: {
    setup: HcmSetupConfig;
    workDate: string;
    worker: AttendancePolicyWorkerContext;
    activeSchedule?: ActiveScheduleContext;
  }): ResolvedAttendanceWorkerDay {
    const location = locationForWorker(input.setup, input.worker);
    const holidayResolution = this.resolveHoliday({
      policy: input.setup.attendancePolicy,
      workDate: input.workDate,
      countryCode: location?.countryCode,
      workplaceCode: input.worker.workplaceCode,
    });
    const flexibleRule = this.resolveFlexibleRule(input.setup.attendancePolicy.flexibleHoursRules ?? [], input.worker);
    const rotation = this.resolveShiftRotation(input.setup.attendancePolicy.shiftRotations ?? [], input.worker, input.workDate);
    const defaultWorkDays = input.setup.attendancePolicy.workDays ?? [0, 1, 2, 3, 4];
    const workDay = workDateToUtc(input.workDate).getUTCDay();

    if (input.activeSchedule) {
      const scheduleDays = Array.isArray(input.activeSchedule.daysOfWeek) ? input.activeSchedule.daysOfWeek : [];
      const scheduledWorkDays = scheduleDays.map(dayCodeToIndex).filter((day): day is number => day !== undefined);
      return {
        scheduled: scheduledWorkDays.includes(workDay),
        scheduledDailyMinutes: input.activeSchedule.hoursPerDay === undefined ? undefined : Math.round(input.activeSchedule.hoursPerDay * 60),
        scheduledWorkDays,
        scheduleId: typeof input.activeSchedule.id === 'string' ? input.activeSchedule.id : input.activeSchedule.id?.value,
        scheduleLabel: input.activeSchedule.scheduleType,
        holiday: holidayResolution.holiday,
        effectivePolicy: this.mergeEffectivePolicy(input.setup.attendancePolicy, flexibleRule.rule),
        evidence: {
          scheduleSource: 'INDIVIDUAL_SCHEDULE',
          holidayScope: holidayResolution.scope,
          flexibleRuleCode: flexibleRule.rule?.code,
        },
      };
    }

    if (rotation) {
      return {
        scheduled: rotation.workDayOffsets.includes(cycleOffset(rotation.anchorDate, input.workDate, rotation.cycleDays)),
        scheduledDailyMinutes: rotation.dailyMinutes,
        shiftCode: rotation.code,
        shiftLabel: rotation.label,
        holiday: holidayResolution.holiday,
        effectivePolicy: this.mergeEffectivePolicy(input.setup.attendancePolicy, flexibleRule.rule, {
          standardStartTime: rotation.startTime,
          standardEndTime: rotation.endTime,
          standardDailyMinutes: rotation.dailyMinutes,
          overtimeAfterMinutes: rotation.dailyMinutes,
        }),
        evidence: {
          scheduleSource: 'SHIFT_ROTATION',
          holidayScope: holidayResolution.scope,
          flexibleRuleCode: flexibleRule.rule?.code,
        },
      };
    }

    return {
      scheduled: defaultWorkDays.includes(workDay),
      scheduledWorkDays: defaultWorkDays,
      holiday: holidayResolution.holiday,
      effectivePolicy: this.mergeEffectivePolicy(input.setup.attendancePolicy, flexibleRule.rule),
      evidence: {
        scheduleSource: 'TENANT_DEFAULT',
        holidayScope: holidayResolution.scope,
        flexibleRuleCode: flexibleRule.rule?.code,
      },
    };
  }

  resolveHoliday(input: {
    policy: AttendancePolicy;
    workDate: string;
    countryCode?: string;
    workplaceCode?: string;
  }): { holiday?: AttendanceHolidayRule; scope?: 'LOCATION' | 'COUNTRY' | 'GLOBAL' } {
    const candidates = normalizeLegacyHolidays(input.policy).filter((holiday) => holiday.date === input.workDate);
    const locationHoliday = candidates.find((holiday) => input.workplaceCode && holiday.locationCodes?.includes(input.workplaceCode));
    if (locationHoliday) return { holiday: locationHoliday, scope: 'LOCATION' };
    const countryHoliday = candidates.find((holiday) => input.countryCode && holiday.countryCode === input.countryCode);
    if (countryHoliday) return { holiday: countryHoliday, scope: 'COUNTRY' };
    const globalHoliday = candidates.find((holiday) => !holiday.countryCode && (!holiday.locationCodes || holiday.locationCodes.length === 0));
    return globalHoliday ? { holiday: globalHoliday, scope: 'GLOBAL' } : {};
  }

  private resolveShiftRotation(
    rules: AttendanceShiftRotationRule[],
    worker: AttendancePolicyWorkerContext,
    workDate: string,
  ): AttendanceShiftRotationRule | undefined {
    return rules
      .filter((rule) => rule.active && rule.anchorDate <= workDate && targetedMatch(rule, worker))
      .sort(ruleSort)[0];
  }

  private resolveFlexibleRule(
    rules: AttendanceFlexibleHoursRule[],
    worker: AttendancePolicyWorkerContext,
  ): { rule?: AttendanceFlexibleHoursRule } {
    return { rule: rules.filter((rule) => rule.active && targetedMatch(rule, worker)).sort(ruleSort)[0] };
  }

  private mergeEffectivePolicy(
    policy: AttendancePolicy,
    flexibleRule?: AttendanceFlexibleHoursRule,
    overrides?: Partial<AttendancePolicy>,
  ): AttendancePolicy {
    return {
      ...policy,
      ...(flexibleRule?.flexibleWindowStart ? { flexibleWindowStart: flexibleRule.flexibleWindowStart } : {}),
      ...(flexibleRule?.flexibleWindowEnd ? { flexibleWindowEnd: flexibleRule.flexibleWindowEnd } : {}),
      ...(flexibleRule?.coreStartTime ? { coreStartTime: flexibleRule.coreStartTime } : {}),
      ...(flexibleRule?.coreEndTime ? { coreEndTime: flexibleRule.coreEndTime } : {}),
      ...(flexibleRule?.minimumPayableDayMinutes !== undefined ? { minimumPayableDayMinutes: flexibleRule.minimumPayableDayMinutes } : {}),
      ...(overrides?.standardStartTime ? { standardStartTime: overrides.standardStartTime } : {}),
      ...(overrides?.standardEndTime ? { standardEndTime: overrides.standardEndTime } : {}),
      ...(overrides?.standardDailyMinutes !== undefined ? { standardDailyMinutes: overrides.standardDailyMinutes } : {}),
      ...(overrides?.overtimeAfterMinutes !== undefined ? { overtimeAfterMinutes: overrides.overtimeAfterMinutes } : {}),
    };
  }
}
