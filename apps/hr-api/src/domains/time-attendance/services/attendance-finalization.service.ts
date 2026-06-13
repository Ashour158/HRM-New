import { Injectable } from '@nestjs/common';
import type { AttendanceDailyLedger, AttendanceLedgerRow } from './attendance-ledger.service.js';

export interface AttendanceLedgerSnapshotRecord {
  tenantId: string;
  workerId: string;
  employeeId: string;
  workerName: string;
  workDate: string;
  status: AttendanceLedgerRow['status'];
  scheduled: boolean;
  holidayName?: string;
  firstCheckInAt?: Date;
  latestCheckOutAt?: Date;
  locationStatus: string;
  workedMinutes: number;
  payableMinutes: number;
  deductionMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  exceptionCount: number;
  readyForPayroll: boolean;
  locked: boolean;
  lockedAt: Date;
  lockedBy: string;
  payrollCycleId?: string;
  sourceHash: string;
  payrollPayload: {
    workedMinutes: number;
    payableMinutes: number;
    deductionMinutes: number;
    overtimeMinutes: number;
  };
  ledgerPayload: AttendanceLedgerRow;
  governance: AttendanceLedgerRow['governance'];
}

export interface AttendancePayrollHandoffInput {
  tenantId: string;
  workerId: string;
  payrollCycleId: string;
  inputType: 'ATTENDANCE_DAILY_LEDGER';
  amount: number;
  currency: string;
  description: string;
}

export interface AttendanceFinalizationResult {
  canFinalize: boolean;
  blockedRows: AttendanceLedgerRow[];
  snapshots: AttendanceLedgerSnapshotRecord[];
  payrollInputs: AttendancePayrollHandoffInput[];
}

function sourceHash(row: AttendanceLedgerRow): string {
  return [
    row.worker.workerId,
    row.workDate,
    row.status,
    row.firstCheckInAt ?? '',
    row.latestCheckOutAt ?? '',
    row.payrollInput.workedMinutes,
    row.payrollInput.payableMinutes,
    row.payrollInput.deductionMinutes,
    row.payrollInput.overtimeMinutes,
    row.exceptions.map((exception) => `${exception.code}:${exception.status}:${exception.payrollImpactMinutes}`).join('|'),
  ].join('#');
}

function requirePayrollCurrency(currency?: string): string {
  if (!currency) {
    throw new Error('Attendance payroll handoff currency is required');
  }
  return currency;
}

@Injectable()
export class AttendanceFinalizationService {
  finalizeDailyLedger(ledger: AttendanceDailyLedger, options: {
    tenantId: string;
    lockedBy: string;
    payrollCycleId?: string;
    lockedAt?: Date;
    currency?: string;
  }): AttendanceFinalizationResult {
    const blockedRows = ledger.rows.filter((row) => !row.payrollInput.readyForPayroll);
    if (blockedRows.length > 0) {
      return {
        canFinalize: false,
        blockedRows,
        snapshots: [],
        payrollInputs: [],
      };
    }

    const lockedAt = options.lockedAt ?? new Date();
    const snapshots = ledger.rows.map<AttendanceLedgerSnapshotRecord>((row) => ({
      tenantId: options.tenantId,
      workerId: row.worker.workerId,
      employeeId: row.worker.employeeId,
      workerName: row.worker.name,
      workDate: row.workDate,
      status: row.status,
      scheduled: row.scheduled,
      holidayName: row.holidayName,
      firstCheckInAt: row.firstCheckInAt ? new Date(row.firstCheckInAt) : undefined,
      latestCheckOutAt: row.latestCheckOutAt ? new Date(row.latestCheckOutAt) : undefined,
      locationStatus: row.locationStatus,
      workedMinutes: row.payrollInput.workedMinutes,
      payableMinutes: row.payrollInput.payableMinutes,
      deductionMinutes: row.payrollInput.deductionMinutes,
      overtimeMinutes: row.payrollInput.overtimeMinutes,
      lateMinutes: row.calculation.lateMinutes,
      undertimeMinutes: row.calculation.undertimeMinutes,
      exceptionCount: row.exceptions.length,
      readyForPayroll: row.payrollInput.readyForPayroll,
      locked: true,
      lockedAt,
      lockedBy: options.lockedBy,
      payrollCycleId: options.payrollCycleId,
      sourceHash: sourceHash(row),
      payrollPayload: {
        workedMinutes: row.payrollInput.workedMinutes,
        payableMinutes: row.payrollInput.payableMinutes,
        deductionMinutes: row.payrollInput.deductionMinutes,
        overtimeMinutes: row.payrollInput.overtimeMinutes,
      },
      ledgerPayload: row,
      governance: row.governance,
    }));

    return {
      canFinalize: true,
      blockedRows: [],
      snapshots,
      payrollInputs: options.payrollCycleId
        ? snapshots.map((snapshot) => ({
          tenantId: options.tenantId,
          workerId: snapshot.workerId,
          payrollCycleId: options.payrollCycleId as string,
          inputType: 'ATTENDANCE_DAILY_LEDGER',
          amount: snapshot.deductionMinutes,
          currency: requirePayrollCurrency(options.currency),
          description: `Attendance ${snapshot.workDate}: payable ${snapshot.payableMinutes}m, deduction ${snapshot.deductionMinutes}m, overtime ${snapshot.overtimeMinutes}m`,
        }))
        : [],
    };
  }
}
