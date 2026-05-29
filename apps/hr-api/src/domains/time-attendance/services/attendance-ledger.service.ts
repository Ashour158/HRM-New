import { Injectable } from '@nestjs/common';
import type { TimeClockEvent } from '../aggregates/time-clock-event.aggregate.js';
import type { AttendanceException } from '../aggregates/attendance-exception.aggregate.js';
import { AttendanceCalculationService, type AttendanceDayCalculation, type AttendancePolicy, type AttendanceSession } from './attendance-calculation.service.js';
import { AttendanceStateService } from './attendance-state.service.js';

export type AttendanceLedgerStatus =
  | 'ABSENT'
  | 'GEOFENCE_VIOLATION'
  | 'HOLIDAY'
  | 'IN_PROGRESS'
  | 'LATE'
  | 'LEAVE_CLOCK_EVENT_CONFLICT'
  | 'LOW_TRUST'
  | 'MISSING_CHECKOUT'
  | 'ON_DUTY'
  | 'ON_LEAVE'
  | 'OUT'
  | 'OVERTIME'
  | 'PRESENT'
  | 'UNDERTIME'
  | 'WEEKEND';

export type AttendanceExceptionSeverity = 'HIGH' | 'LOW' | 'MEDIUM';

export interface AttendanceLedgerWorker {
  workerId: string;
  employeeId: string;
  name: string;
  email: string;
  departmentName?: string;
  managerId?: string;
  scheduledDailyMinutes?: number;
  scheduledWorkDays?: number[];
  scheduled?: boolean;
  scheduleId?: string;
  scheduleLabel?: string;
  shiftCode?: string;
  shiftLabel?: string;
  holiday?: AttendanceHoliday;
  approvedLeave?: AttendanceApprovedLeave;
  effectivePolicy?: AttendancePolicy;
  policyEvidence?: {
    scheduleSource?: string;
    holidayScope?: string;
    flexibleRuleCode?: string;
  };
  workLocationCode?: string;
  status: string;
}

export interface AttendanceHoliday {
  date: string;
  name: string;
  paid?: boolean;
}

export interface AttendanceApprovedLeave {
  absenceRequestId: string;
  absenceType: string;
  paid: boolean;
  startDate: string;
  endDate: string;
}

export interface AttendanceLedgerException {
  code:
    | 'ABSENCE'
    | 'DUPLICATE_PUNCH'
    | 'GEOFENCE_VIOLATION'
    | 'LATE'
    | 'LEAVE_CLOCK_EVENT_CONFLICT'
    | 'LOW_TRUST_CLOCK_EVENT'
    | 'MISSING_CHECKOUT'
    | 'ON_DUTY_REQUEST'
    | 'OVERTIME'
    | 'UNDERTIME';
  description: string;
  severity: AttendanceExceptionSeverity;
  requiresApproval: boolean;
  source: 'CALCULATED' | 'REQUEST' | 'SYSTEM';
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED';
  payrollImpactMinutes: number;
  exceptionId?: string;
}

export interface AttendancePayrollInput {
  workDate: string;
  workedMinutes: number;
  payableMinutes: number;
  deductionMinutes: number;
  overtimeMinutes: number;
  readyForPayroll: boolean;
  locked: boolean;
  source: 'ATTENDANCE_DAILY_LEDGER';
}

export interface AttendanceLedgerRow {
  worker: AttendanceLedgerWorker;
  workDate: string;
  status: AttendanceLedgerStatus;
  scheduled: boolean;
  holidayName?: string;
  firstCheckInAt?: string;
  latestCheckOutAt?: string;
  locationStatus: string;
  calculation: AttendanceDayCalculation;
  exceptions: AttendanceLedgerException[];
  payrollInput: AttendancePayrollInput;
  policyEvidence: {
    schedule: {
      source: string;
      scheduleId?: string;
      scheduleLabel?: string;
      shiftCode?: string;
      shiftLabel?: string;
    };
    holiday?: {
      name: string;
      scope?: string;
      paid?: boolean;
    };
    leave?: {
      absenceRequestId: string;
      absenceType: string;
      paid: boolean;
      startDate: string;
      endDate: string;
    };
    trust: {
      minClockTrustScore: number;
      lowTrustBlocksPayroll: boolean;
    };
    flexibleRuleCode?: string;
  };
  governance: {
    visibilityScope: 'EMPLOYEE_SELF' | 'HR_ADMIN' | 'MANAGER_TEAM' | 'PAYROLL';
    locationDataClassification: 'CONFIDENTIAL';
    payrollDataClassification: 'CONFIDENTIAL';
  };
}

export interface AttendanceLedgerSummary {
  absent: number;
  exceptions: number;
  geofenceViolations: number;
  inProgress: number;
  late: number;
  missingCheckout: number;
  onLeave: number;
  payrollReady: number;
  present: number;
  totalEmployees: number;
  undertime: number;
}

export interface AttendanceExceptionQueueItem extends AttendanceLedgerException {
  workerId: string;
  employeeId: string;
  workerName: string;
  workDate: string;
  managerId?: string;
  firstCheckInAt?: string;
  latestCheckOutAt?: string;
  locationStatus: string;
  policyEvidence: AttendanceLedgerRow['policyEvidence'];
}

export interface AttendanceDailyLedger {
  workDate: string;
  rows: AttendanceLedgerRow[];
  summary: AttendanceLedgerSummary;
  exceptionQueue: AttendanceExceptionQueueItem[];
}

function parseDescription(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { note: value };
  }
}

function parseLocation(value?: string): { distanceMeters?: number; trustScore?: number } {
  if (!value) return {};
  try {
    return JSON.parse(value) as { distanceMeters?: number; trustScore?: number };
  } catch {
    return {};
  }
}

function eventDateKey(event: TimeClockEvent, timezoneOffsetMinutes: number): string {
  return new Date(event.timestamp.getTime() + timezoneOffsetMinutes * 60000).toISOString().slice(0, 10);
}

function toSessions(events: TimeClockEvent[]): AttendanceSession[] {
  const sessions: AttendanceSession[] = [];
  let checkIn: TimeClockEvent | undefined;
  for (const event of [...events].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime())) {
    if (event.eventType === 'CLOCK_IN') checkIn = event;
    if (event.eventType === 'CLOCK_OUT' && checkIn) {
      sessions.push({
        checkInAt: checkIn.timestamp,
        checkOutAt: event.timestamp,
        distanceMeters: parseLocation(checkIn.location).distanceMeters,
        trustScore: parseLocation(checkIn.location).trustScore,
      });
      checkIn = undefined;
    }
  }
  return sessions;
}

function hasDuplicatePunch(events: TimeClockEvent[]): boolean {
  const sorted = [...events].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
  return sorted.some((event, index) => index > 0 && sorted[index - 1]?.eventType === event.eventType);
}

function minutesFromException(exception: AttendanceException): number {
  const payload = parseDescription(exception.description);
  const startAt = typeof payload.startAt === 'string' ? new Date(payload.startAt) : undefined;
  const endAt = typeof payload.endAt === 'string' ? new Date(payload.endAt) : undefined;
  if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return 0;
  return Math.max(Math.round((endAt.getTime() - startAt.getTime()) / 60000), 0);
}

function resolveStatus(args: {
  calculation: AttendanceDayCalculation;
  duplicatePunch: boolean;
  hasEvents: boolean;
  holiday?: AttendanceHoliday;
  missingCheckout: boolean;
  onDutyMinutes: number;
  approvedLeave?: AttendanceApprovedLeave;
  scheduled: boolean;
}): AttendanceLedgerStatus {
  if (args.holiday) return 'HOLIDAY';
  if (args.approvedLeave && args.hasEvents) return 'LEAVE_CLOCK_EVENT_CONFLICT';
  if (args.approvedLeave) return 'ON_LEAVE';
  if (!args.scheduled && !args.hasEvents) return 'WEEKEND';
  if (args.missingCheckout) return 'MISSING_CHECKOUT';
  if (args.duplicatePunch) return 'MISSING_CHECKOUT';
  if (args.calculation.geofenceViolation) return 'GEOFENCE_VIOLATION';
  if (args.calculation.lowTrustPunch) return 'LOW_TRUST';
  if (!args.scheduled && args.hasEvents) return args.calculation.overtimeMinutes > 0 ? 'OVERTIME' : 'OUT';
  if (args.calculation.absent) return 'ABSENT';
  if (args.onDutyMinutes > 0) return 'ON_DUTY';
  if (args.calculation.overtimeMinutes > 0) return 'OVERTIME';
  if (args.calculation.undertimeMinutes > 0) return 'UNDERTIME';
  if (args.calculation.lateMinutes > 0) return 'LATE';
  return args.hasEvents ? 'OUT' : 'PRESENT';
}

function blocksPayroll(exception: AttendanceLedgerException, policy: AttendancePolicy): boolean {
  if (exception.status === 'RESOLVED') return false;
  if (exception.code === 'MISSING_CHECKOUT') return policy.missingCheckoutBlocksPayroll ?? true;
  if (exception.code === 'DUPLICATE_PUNCH') return policy.duplicatePunchBlocksPayroll ?? true;
  if (exception.code === 'LOW_TRUST_CLOCK_EVENT') return policy.lowTrustPunchBlocksPayroll ?? true;
  return exception.requiresApproval;
}

@Injectable()
export class AttendanceLedgerService {
  private readonly calculation = new AttendanceCalculationService();
  private readonly state = new AttendanceStateService();

  buildDailyLedger(input: {
    workDate: string;
    workers: AttendanceLedgerWorker[];
    eventsByWorkerId: Map<string, TimeClockEvent[]>;
    exceptionsByWorkerId: Map<string, AttendanceException[]>;
    policy: AttendancePolicy;
    holidays: AttendanceHoliday[];
    workDays?: number[];
    now?: Date;
  }): AttendanceDailyLedger {
    const timezoneOffsetMinutes = input.policy.timezoneOffsetMinutes ?? 0;
    const workDay = new Date(`${input.workDate}T00:00:00.000Z`).getUTCDay();
    const workDays = input.workDays ?? [0, 1, 2, 3, 4];
    const globalHoliday = input.holidays.find((item) => item.date === input.workDate);
    const rows = input.workers
      .filter((worker) => worker.status === 'ACTIVE')
      .map((worker) => this.buildRow({
        worker,
        workDate: input.workDate,
        events: (input.eventsByWorkerId.get(worker.workerId) ?? []).filter((event) => eventDateKey(event, timezoneOffsetMinutes) === input.workDate),
        allEvents: input.eventsByWorkerId.get(worker.workerId) ?? [],
        exceptions: input.exceptionsByWorkerId.get(worker.workerId) ?? [],
        policy: {
          ...input.policy,
          ...(worker.effectivePolicy ?? {}),
          ...(worker.scheduledDailyMinutes ? { standardDailyMinutes: worker.scheduledDailyMinutes } : {}),
        },
        holiday: worker.holiday ?? globalHoliday,
        scheduled: worker.scheduled ?? ((worker.scheduledWorkDays ?? workDays).includes(workDay) && !(worker.holiday ?? globalHoliday)),
        now: input.now,
      }));

    const exceptionQueue = rows.flatMap((row) => row.exceptions
      .filter((exception) => exception.status !== 'RESOLVED')
      .map((exception) => ({
        ...exception,
        workerId: row.worker.workerId,
        employeeId: row.worker.employeeId,
        workerName: row.worker.name,
        workDate: row.workDate,
        managerId: row.worker.managerId,
        firstCheckInAt: row.firstCheckInAt,
        latestCheckOutAt: row.latestCheckOutAt,
        locationStatus: row.locationStatus,
        policyEvidence: row.policyEvidence,
      })));

    return {
      workDate: input.workDate,
      rows,
      summary: {
        absent: rows.filter((row) => row.status === 'ABSENT').length,
        exceptions: exceptionQueue.length,
        geofenceViolations: rows.filter((row) => row.status === 'GEOFENCE_VIOLATION').length,
        inProgress: rows.filter((row) => row.status === 'IN_PROGRESS').length,
        late: rows.filter((row) => row.exceptions.some((exception) => exception.code === 'LATE')).length,
        missingCheckout: rows.filter((row) => row.exceptions.some((exception) => exception.code === 'MISSING_CHECKOUT')).length,
        onLeave: rows.filter((row) => row.status === 'ON_LEAVE').length,
        payrollReady: rows.filter((row) => row.payrollInput.readyForPayroll).length,
        present: rows.filter((row) => row.status === 'OUT' || row.status === 'PRESENT' || row.status === 'OVERTIME').length,
        totalEmployees: rows.length,
        undertime: rows.filter((row) => row.exceptions.some((exception) => exception.code === 'UNDERTIME')).length,
      },
      exceptionQueue,
    };
  }

  private buildRow(input: {
    worker: AttendanceLedgerWorker;
    workDate: string;
    events: TimeClockEvent[];
    allEvents: TimeClockEvent[];
    exceptions: AttendanceException[];
    policy: AttendancePolicy;
    holiday?: AttendanceHoliday;
    scheduled: boolean;
    now?: Date;
  }): AttendanceLedgerRow {
    const openOnDuty = input.exceptions.filter((exception) => exception.exceptionType === 'ON_DUTY_REQUEST' && exception.status !== 'RESOLVED');
    const approvedOnDutyMinutes = input.exceptions
      .filter((exception) => exception.exceptionType === 'ON_DUTY_REQUEST' && exception.status === 'RESOLVED')
      .reduce((total, exception) => total + minutesFromException(exception), 0);
    const state = this.state.buildTodayState({
      workerId: input.worker.workerId,
      events: input.allEvents,
      policy: input.policy,
      workDate: input.workDate,
      now: input.now,
    });
    const sessions = toSessions(input.events);
    const calculation = this.calculation.calculateDay({
      workDate: input.workDate,
      sessions,
      approvedOnDutyMinutes,
      policy: input.policy,
      timezoneOffsetMinutes: input.policy.timezoneOffsetMinutes,
    });
    const duplicatePunch = hasDuplicatePunch(input.events);
    const missingCheckout = state.status === 'MISSING_CHECKOUT' || (input.events.length > 0 && input.events[input.events.length - 1]?.eventType === 'CLOCK_IN');
    const exceptions: AttendanceLedgerException[] = [];
    const deferPayrollDerivedExceptions = missingCheckout;
    const leavePayableMinutes = input.worker.approvedLeave?.paid ? input.policy.standardDailyMinutes : 0;
    const leaveDeductionMinutes = input.worker.approvedLeave?.paid ? 0 : input.policy.standardDailyMinutes;
    const holidayPayableMinutes = input.holiday && input.holiday.paid !== false ? input.policy.standardDailyMinutes : 0;

    if (calculation.absent && input.scheduled && !missingCheckout && !input.worker.approvedLeave) {
      exceptions.push({
        code: 'ABSENCE',
        description: 'Employee has no attendance events for a scheduled workday.',
        severity: 'HIGH',
        requiresApproval: true,
        source: 'CALCULATED',
        status: 'OPEN',
        payrollImpactMinutes: input.policy.standardDailyMinutes,
      });
    }
    if (missingCheckout) {
      exceptions.push({
        code: 'MISSING_CHECKOUT',
        description: 'Employee has an open check-in without a closing check-out.',
        severity: 'HIGH',
        requiresApproval: true,
        source: 'CALCULATED',
        status: 'OPEN',
        payrollImpactMinutes: 0,
      });
    }
    if (duplicatePunch) {
      exceptions.push({
        code: 'DUPLICATE_PUNCH',
        description: 'Two consecutive attendance events have the same punch type.',
        severity: 'MEDIUM',
        requiresApproval: true,
        source: 'SYSTEM',
        status: 'OPEN',
        payrollImpactMinutes: 0,
      });
    }
    if (input.scheduled && calculation.lateMinutes > 0 && !deferPayrollDerivedExceptions) {
      exceptions.push({
        code: 'LATE',
        description: `Late arrival by ${calculation.lateMinutes} minutes.`,
        severity: 'LOW',
        requiresApproval: false,
        source: 'CALCULATED',
        status: 'OPEN',
        payrollImpactMinutes: calculation.lateMinutes,
      });
    }
    if (input.scheduled && calculation.undertimeMinutes > 0 && !calculation.absent && !deferPayrollDerivedExceptions) {
      exceptions.push({
        code: 'UNDERTIME',
        description: `Worked below scheduled hours by ${calculation.undertimeMinutes} minutes.`,
        severity: 'MEDIUM',
        requiresApproval: false,
        source: 'CALCULATED',
        status: 'OPEN',
        payrollImpactMinutes: calculation.undertimeMinutes,
      });
    }
    if (calculation.overtimeMinutes > 0) {
      exceptions.push({
        code: 'OVERTIME',
        description: `Overtime detected: ${calculation.overtimeMinutes} minutes.`,
        severity: 'MEDIUM',
        requiresApproval: true,
        source: 'CALCULATED',
        status: 'OPEN',
        payrollImpactMinutes: calculation.overtimeMinutes,
      });
    }
    if (calculation.geofenceViolation) {
      exceptions.push({
        code: 'GEOFENCE_VIOLATION',
        description: 'Attendance punch was recorded outside the allowed workplace radius.',
        severity: 'HIGH',
        requiresApproval: true,
        source: 'SYSTEM',
        status: 'OPEN',
        payrollImpactMinutes: 0,
      });
    }
    if (calculation.lowTrustPunch) {
      exceptions.push({
        code: 'LOW_TRUST_CLOCK_EVENT',
        description: `Attendance punch trust score ${calculation.trustScore ?? 0} is below the required threshold.`,
        severity: 'HIGH',
        requiresApproval: true,
        source: 'SYSTEM',
        status: 'OPEN',
        payrollImpactMinutes: 0,
      });
    }
    if (input.worker.approvedLeave && input.events.length > 0) {
      exceptions.push({
        code: 'LEAVE_CLOCK_EVENT_CONFLICT',
        description: `Employee clocked attendance on approved ${input.worker.approvedLeave.absenceType} leave.`,
        severity: 'MEDIUM',
        requiresApproval: true,
        source: 'SYSTEM',
        status: 'OPEN',
        payrollImpactMinutes: 0,
      });
    }
    for (const exception of openOnDuty) {
      const payload = parseDescription(exception.description);
      exceptions.push({
        code: 'ON_DUTY_REQUEST',
        description: typeof payload.reason === 'string' ? payload.reason : 'On-duty request pending approval.',
        severity: 'MEDIUM',
        requiresApproval: true,
        source: 'REQUEST',
        status: exception.status,
        payrollImpactMinutes: minutesFromException(exception),
        exceptionId: exception.id.value,
      });
    }

    const status = resolveStatus({
      calculation,
      duplicatePunch,
      hasEvents: input.events.length > 0,
      holiday: input.holiday,
      missingCheckout,
      onDutyMinutes: approvedOnDutyMinutes,
      approvedLeave: input.worker.approvedLeave,
      scheduled: input.scheduled,
    });
    const payrollBlocking = exceptions.some((exception) => blocksPayroll(exception, input.policy));
    const deductionMinutes = input.holiday || (!input.scheduled && input.events.length === 0)
      ? 0
      : input.worker.approvedLeave
        ? leaveDeductionMinutes
      : exceptions
        .filter((exception) => exception.code !== 'OVERTIME')
        .reduce((total, exception) => total + Math.max(exception.payrollImpactMinutes, 0), 0);
    const suppressAttendanceCalculations = Boolean(input.holiday || (!input.scheduled && input.events.length === 0) || (input.worker.approvedLeave && input.events.length === 0));

    return {
      worker: input.worker,
      workDate: input.workDate,
      status,
      scheduled: input.scheduled,
      holidayName: input.holiday?.name,
      firstCheckInAt: state.firstCheckInAt,
      latestCheckOutAt: state.latestCheckOutAt,
      locationStatus: state.locationStatus,
      calculation,
      exceptions: input.holiday || (!input.scheduled && input.events.length === 0) ? [] : exceptions,
      payrollInput: {
        workDate: input.workDate,
        workedMinutes: suppressAttendanceCalculations ? 0 : calculation.workedMinutes,
        payableMinutes: input.holiday
          ? holidayPayableMinutes
          : !input.scheduled && input.events.length === 0
            ? 0
          : input.worker.approvedLeave && input.events.length === 0
            ? leavePayableMinutes
            : calculation.payableMinutes,
        deductionMinutes,
        overtimeMinutes: suppressAttendanceCalculations ? 0 : calculation.overtimeMinutes,
        readyForPayroll: Boolean(input.holiday || !input.scheduled || !payrollBlocking),
        locked: false,
        source: 'ATTENDANCE_DAILY_LEDGER',
      },
      policyEvidence: {
        schedule: {
          source: input.worker.policyEvidence?.scheduleSource ?? (input.worker.scheduleId ? 'INDIVIDUAL_SCHEDULE' : 'TENANT_DEFAULT'),
          scheduleId: input.worker.scheduleId,
          scheduleLabel: input.worker.scheduleLabel,
          shiftCode: input.worker.shiftCode,
          shiftLabel: input.worker.shiftLabel,
        },
        holiday: input.holiday ? {
          name: input.holiday.name,
          scope: input.worker.policyEvidence?.holidayScope,
          paid: input.holiday.paid,
        } : undefined,
        leave: input.worker.approvedLeave ? {
          absenceRequestId: input.worker.approvedLeave.absenceRequestId,
          absenceType: input.worker.approvedLeave.absenceType,
          paid: input.worker.approvedLeave.paid,
          startDate: input.worker.approvedLeave.startDate,
          endDate: input.worker.approvedLeave.endDate,
        } : undefined,
        trust: {
          minClockTrustScore: input.policy.minClockTrustScore ?? 60,
          lowTrustBlocksPayroll: input.policy.lowTrustPunchBlocksPayroll ?? true,
        },
        flexibleRuleCode: input.worker.policyEvidence?.flexibleRuleCode,
      },
      governance: {
        visibilityScope: 'HR_ADMIN',
        locationDataClassification: 'CONFIDENTIAL',
        payrollDataClassification: 'CONFIDENTIAL',
      },
    };
  }
}
