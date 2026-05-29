import { Injectable } from '@nestjs/common';
import type { TimesheetEntry } from '../aggregates/timesheet.aggregate.js';
import type { AttendanceDailyLedgerStoredRecord } from '../repositories/attendance-daily-ledger.repository.js';

export interface AttendanceTimesheetProjectionInput {
  workerId: string;
  periodStart: string;
  periodEnd: string;
  snapshots: AttendanceDailyLedgerStoredRecord[];
}

export interface AttendanceTimesheetProjectionResult {
  workerId: string;
  periodStart: string;
  periodEnd: string;
  entries: TimesheetEntry[];
  totalHours: number;
  sourceLedgerIds: string[];
  blockedReasons: string[];
}

function dayStart(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isWithinPeriod(workDate: string, periodStart: string, periodEnd: string): boolean {
  const day = dayStart(workDate).getTime();
  return dayStart(periodStart).getTime() <= day && day <= dayStart(periodEnd).getTime();
}

@Injectable()
export class AttendanceTimesheetProjectionService {
  projectWorkerTimesheet(input: AttendanceTimesheetProjectionInput): AttendanceTimesheetProjectionResult {
    const eligibleSnapshots = input.snapshots
      .filter((snapshot) => snapshot.workerId === input.workerId)
      .filter((snapshot) => isWithinPeriod(snapshot.workDate, input.periodStart, input.periodEnd))
      .filter((snapshot) => snapshot.locked && snapshot.readyForPayroll)
      .sort((left, right) => left.workDate.localeCompare(right.workDate));

    const entries = eligibleSnapshots
      .filter((snapshot) => snapshot.payableMinutes > 0)
      .map<TimesheetEntry>((snapshot) => ({
        date: dayStart(snapshot.workDate),
        hours: Math.round((snapshot.payableMinutes / 60) * 100) / 100,
        projectCode: `ATTENDANCE:${snapshot.status}`,
      }));

    const blockedReasons: string[] = [];
    if (entries.length === 0) {
      blockedReasons.push('No locked payroll-ready attendance ledger rows found for this worker and period.');
    }

    return {
      workerId: input.workerId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      entries,
      totalHours: Math.round(entries.reduce((total, entry) => total + entry.hours, 0) * 100) / 100,
      sourceLedgerIds: eligibleSnapshots.map((snapshot) => snapshot.id),
      blockedReasons,
    };
  }
}
