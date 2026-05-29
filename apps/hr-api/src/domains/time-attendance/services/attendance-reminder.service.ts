import { Injectable } from '@nestjs/common';
import type { AttendanceDailyLedger, AttendanceLedgerRow } from './attendance-ledger.service.js';
import type { AttendancePolicy } from './attendance-calculation.service.js';

export type AttendanceReminderType = 'LATE_CHECK_IN' | 'MISSING_CHECK_OUT';

export interface AttendanceReminder {
  type: AttendanceReminderType;
  workerId: string;
  employeeId: string;
  workerName: string;
  workDate: string;
  scheduledTime: string;
  minutesLate: number;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
}

function localMinutesForTime(value?: string): number | undefined {
  if (!value) return undefined;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return hours * 60 + minutes;
}

function localMinutesFromDate(date: Date, timezoneOffsetMinutes: number): number {
  const local = new Date(date.getTime() + timezoneOffsetMinutes * 60000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

function isCheckInReminderCandidate(row: AttendanceLedgerRow): boolean {
  return row.scheduled && !row.holidayName && row.status !== 'ON_LEAVE' && !row.firstCheckInAt;
}

function isCheckOutReminderCandidate(row: AttendanceLedgerRow): boolean {
  return row.scheduled && !row.holidayName && row.status !== 'ON_LEAVE' && Boolean(row.firstCheckInAt) && !row.latestCheckOutAt;
}

@Injectable()
export class AttendanceReminderService {
  buildReminders(input: {
    ledger: AttendanceDailyLedger;
    policy: AttendancePolicy;
    now?: Date;
  }): AttendanceReminder[] {
    const now = input.now ?? new Date();
    const timezoneOffsetMinutes = input.policy.timezoneOffsetMinutes ?? 0;
    const nowMinutes = localMinutesFromDate(now, timezoneOffsetMinutes);
    const grace = input.policy.lateGraceMinutes ?? 0;
    const startMinutes = localMinutesForTime(input.policy.standardStartTime) ?? 9 * 60;
    const endMinutes = localMinutesForTime(input.policy.standardEndTime) ?? startMinutes + input.policy.standardDailyMinutes;
    const reminders: AttendanceReminder[] = [];

    for (const row of input.ledger.rows) {
      if (isCheckInReminderCandidate(row) && nowMinutes > startMinutes + grace) {
        const minutesLate = nowMinutes - startMinutes;
        reminders.push({
          type: 'LATE_CHECK_IN',
          workerId: row.worker.workerId,
          employeeId: row.worker.employeeId,
          workerName: row.worker.name,
          workDate: row.workDate,
          scheduledTime: input.policy.standardStartTime ?? '09:00',
          minutesLate,
          severity: minutesLate >= 60 ? 'CRITICAL' : 'WARNING',
          message: `${row.worker.name} has not checked in for a scheduled workday.`,
        });
      }

      if (isCheckOutReminderCandidate(row) && nowMinutes > endMinutes + grace) {
        const minutesLate = nowMinutes - endMinutes;
        reminders.push({
          type: 'MISSING_CHECK_OUT',
          workerId: row.worker.workerId,
          employeeId: row.worker.employeeId,
          workerName: row.worker.name,
          workDate: row.workDate,
          scheduledTime: input.policy.standardEndTime ?? '17:00',
          minutesLate,
          severity: minutesLate >= 60 ? 'CRITICAL' : 'WARNING',
          message: `${row.worker.name} has an open attendance session without check-out.`,
        });
      }
    }

    return reminders;
  }
}
