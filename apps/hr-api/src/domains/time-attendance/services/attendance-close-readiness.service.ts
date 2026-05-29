import { Injectable } from '@nestjs/common';
import type { AttendanceDailyLedgerStoredRecord } from '../repositories/attendance-daily-ledger.repository.js';
import type { AttendanceCorrectionRequestRecord } from './attendance-correction.service.js';

export type AttendanceCloseIssueCode =
  | 'ATTENDANCE_LEDGER_MISSING'
  | 'ATTENDANCE_LEDGER_NOT_LOCKED'
  | 'ATTENDANCE_LEDGER_NOT_READY'
  | 'ATTENDANCE_CORRECTION_PENDING'
  | 'ATTENDANCE_CORRECTION_APPROVED_NOT_APPLIED';

export interface AttendanceCloseEmployee {
  workerId: string;
  employeeId: string;
  name: string;
  departmentName?: string;
  workLocationCode?: string;
}

export interface AttendanceCloseReadinessIssue {
  code: AttendanceCloseIssueCode;
  severity: 'ERROR' | 'WARNING';
  blocking: boolean;
  workerId: string;
  employeeId?: string;
  employeeName?: string;
  workDate: string;
  message: string;
  correctionRequestId?: string;
}

export interface AttendanceCloseReadinessResult {
  canClose: boolean;
  periodStart: string;
  periodEnd: string;
  totalEmployees: number;
  totalDays: number;
  totalExpectedRows: number;
  lockedRows: number;
  readyRows: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  issues: AttendanceCloseReadinessIssue[];
}

export interface AttendanceCloseReadinessInput {
  periodStart: string;
  periodEnd: string;
  employees: AttendanceCloseEmployee[];
  snapshots: AttendanceDailyLedgerStoredRecord[];
  corrections: AttendanceCorrectionRequestRecord[];
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function enumerateDateKeys(periodStart: string, periodEnd: string): string[] {
  const start = parseDateKey(periodStart);
  const end = parseDateKey(periodEnd);
  const days: string[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    days.push(dateKey(cursor));
  }
  return days;
}

@Injectable()
export class AttendanceCloseReadinessService {
  evaluatePeriod(input: AttendanceCloseReadinessInput): AttendanceCloseReadinessResult {
    const days = enumerateDateKeys(input.periodStart, input.periodEnd);
    const snapshotByWorkerDate = new Map(
      input.snapshots.map((snapshot) => [`${snapshot.workerId}:${snapshot.workDate}`, snapshot]),
    );
    const employeeByWorkerId = new Map(input.employees.map((employee) => [employee.workerId, employee]));
    const issues: AttendanceCloseReadinessIssue[] = [];

    for (const workDate of days) {
      for (const employee of input.employees) {
        const snapshot = snapshotByWorkerDate.get(`${employee.workerId}:${workDate}`);
        if (!snapshot) {
          issues.push({
            code: 'ATTENDANCE_LEDGER_MISSING',
            severity: 'ERROR',
            blocking: true,
            workerId: employee.workerId,
            employeeId: employee.employeeId,
            employeeName: employee.name,
            workDate,
            message: `${employee.employeeId} has no locked attendance ledger snapshot for ${workDate}.`,
          });
          continue;
        }
        if (!snapshot.locked) {
          issues.push({
            code: 'ATTENDANCE_LEDGER_NOT_LOCKED',
            severity: 'ERROR',
            blocking: true,
            workerId: employee.workerId,
            employeeId: employee.employeeId,
            employeeName: employee.name,
            workDate,
            message: `${employee.employeeId} has an attendance ledger for ${workDate}, but it is not locked.`,
          });
        }
        if (!snapshot.readyForPayroll) {
          issues.push({
            code: 'ATTENDANCE_LEDGER_NOT_READY',
            severity: 'ERROR',
            blocking: true,
            workerId: employee.workerId,
            employeeId: employee.employeeId,
            employeeName: employee.name,
            workDate,
            message: `${employee.employeeId} has an attendance ledger for ${workDate}, but it is not ready for payroll.`,
          });
        }
      }
    }

    for (const correction of input.corrections) {
      if (!days.includes(correction.workDate)) continue;
      const employee = employeeByWorkerId.get(correction.workerId);
      if (correction.status === 'PENDING_MANAGER_REVIEW') {
        issues.push({
          code: 'ATTENDANCE_CORRECTION_PENDING',
          severity: 'ERROR',
          blocking: true,
          workerId: correction.workerId,
          employeeId: employee?.employeeId,
          employeeName: employee?.name,
          workDate: correction.workDate,
          correctionRequestId: correction.id,
          message: `Correction request ${correction.id} is still waiting for review.`,
        });
      }
      if (correction.status === 'APPROVED') {
        issues.push({
          code: 'ATTENDANCE_CORRECTION_APPROVED_NOT_APPLIED',
          severity: 'ERROR',
          blocking: true,
          workerId: correction.workerId,
          employeeId: employee?.employeeId,
          employeeName: employee?.name,
          workDate: correction.workDate,
          correctionRequestId: correction.id,
          message: `Correction request ${correction.id} is approved but not applied.`,
        });
      }
    }

    const blockingIssueCount = issues.filter((issue) => issue.blocking).length;
    return {
      canClose: blockingIssueCount === 0,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      totalEmployees: input.employees.length,
      totalDays: days.length,
      totalExpectedRows: input.employees.length * days.length,
      lockedRows: input.snapshots.filter((snapshot) => snapshot.locked).length,
      readyRows: input.snapshots.filter((snapshot) => snapshot.readyForPayroll).length,
      blockingIssueCount,
      warningIssueCount: issues.length - blockingIssueCount,
      issues,
    };
  }
}
