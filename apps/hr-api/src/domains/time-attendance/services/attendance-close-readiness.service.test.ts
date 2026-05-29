import { describe, expect, it } from 'vitest';
import { AttendanceCloseReadinessService } from './attendance-close-readiness.service.js';
import type { AttendanceDailyLedgerStoredRecord } from '../repositories/attendance-daily-ledger.repository.js';
import type { AttendanceCorrectionRequestRecord } from './attendance-correction.service.js';

const employee = {
  workerId: 'worker-1',
  employeeId: 'EMP-001',
  name: 'Employee One',
  departmentName: 'Operations',
  workLocationCode: 'CAIRO_HQ',
};

function snapshot(overrides: Partial<AttendanceDailyLedgerStoredRecord> = {}): AttendanceDailyLedgerStoredRecord {
  return {
    id: 'ledger-1',
    tenantId: 'tenant-1',
    workerId: employee.workerId,
    employeeId: employee.employeeId,
    workerName: employee.name,
    workDate: '2026-05-01',
    status: 'PRESENT',
    scheduled: true,
    locationStatus: 'INSIDE_GEOFENCE',
    workedMinutes: 480,
    payableMinutes: 480,
    deductionMinutes: 0,
    overtimeMinutes: 0,
    lateMinutes: 0,
    undertimeMinutes: 0,
    exceptionCount: 0,
    readyForPayroll: true,
    locked: true,
    lockedAt: new Date('2026-05-02T08:00:00.000Z'),
    lockedBy: 'payroll-admin',
    sourceHash: 'hash-1',
    payrollPayload: {
      workedMinutes: 480,
      payableMinutes: 480,
      deductionMinutes: 0,
      overtimeMinutes: 0,
    },
    ledgerPayload: {} as AttendanceDailyLedgerStoredRecord['ledgerPayload'],
    governance: {
      visibilityScope: 'HR_ADMIN',
      locationDataClassification: 'CONFIDENTIAL',
      payrollDataClassification: 'CONFIDENTIAL',
    },
    aggregateVersion: 0,
    createdAt: new Date('2026-05-02T08:00:00.000Z'),
    updatedAt: new Date('2026-05-02T08:00:00.000Z'),
    ...overrides,
  };
}

function correction(overrides: Partial<AttendanceCorrectionRequestRecord> = {}): AttendanceCorrectionRequestRecord {
  return {
    id: 'correction-1',
    tenantId: 'tenant-1',
    workerId: employee.workerId,
    workDate: '2026-05-01',
    correctionType: 'ADD_CLOCK_EVENT',
    requestedEventType: 'CLOCK_IN',
    requestedTimestamp: new Date('2026-05-01T07:00:00.000Z'),
    reason: 'Forgot to check in',
    status: 'PENDING_MANAGER_REVIEW',
    requestedBy: employee.workerId,
    requestedAt: new Date('2026-05-01T10:00:00.000Z'),
    auditTrail: [],
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
    updatedAt: new Date('2026-05-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('AttendanceCloseReadinessService', () => {
  const service = new AttendanceCloseReadinessService();

  it('blocks period close when an expected employee day has no locked ledger snapshot', () => {
    const readiness = service.evaluatePeriod({
      periodStart: '2026-05-01',
      periodEnd: '2026-05-02',
      employees: [employee],
      snapshots: [snapshot({ workDate: '2026-05-01' })],
      corrections: [],
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.totalExpectedRows).toBe(2);
    expect(readiness.lockedRows).toBe(1);
    expect(readiness.issues).toEqual([
      expect.objectContaining({
        code: 'ATTENDANCE_LEDGER_MISSING',
        blocking: true,
        workerId: employee.workerId,
        employeeId: employee.employeeId,
        workDate: '2026-05-02',
      }),
    ]);
  });

  it('blocks period close when a ledger row is unlocked or not payroll ready', () => {
    const readiness = service.evaluatePeriod({
      periodStart: '2026-05-01',
      periodEnd: '2026-05-01',
      employees: [employee],
      snapshots: [snapshot({ locked: false, readyForPayroll: false })],
      corrections: [],
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.blockingIssueCount).toBe(2);
    expect(readiness.issues.map((issue) => issue.code)).toEqual([
      'ATTENDANCE_LEDGER_NOT_LOCKED',
      'ATTENDANCE_LEDGER_NOT_READY',
    ]);
  });

  it('blocks period close while corrections are pending or approved but not applied', () => {
    const readiness = service.evaluatePeriod({
      periodStart: '2026-05-01',
      periodEnd: '2026-05-01',
      employees: [employee],
      snapshots: [snapshot()],
      corrections: [
        correction({ id: 'correction-1', status: 'PENDING_MANAGER_REVIEW' }),
        correction({ id: 'correction-2', status: 'APPROVED' }),
      ],
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.issues.map((issue) => issue.code)).toEqual([
      'ATTENDANCE_CORRECTION_PENDING',
      'ATTENDANCE_CORRECTION_APPROVED_NOT_APPLIED',
    ]);
  });

  it('allows period close when every expected row is locked, ready, and corrections are closed', () => {
    const readiness = service.evaluatePeriod({
      periodStart: '2026-05-01',
      periodEnd: '2026-05-02',
      employees: [employee],
      snapshots: [
        snapshot({ id: 'ledger-1', workDate: '2026-05-01' }),
        snapshot({ id: 'ledger-2', workDate: '2026-05-02' }),
      ],
      corrections: [
        correction({ id: 'correction-1', status: 'APPLIED' }),
        correction({ id: 'correction-2', status: 'REJECTED' }),
      ],
    });

    expect(readiness).toMatchObject({
      canClose: true,
      totalExpectedRows: 2,
      lockedRows: 2,
      readyRows: 2,
      blockingIssueCount: 0,
      warningIssueCount: 0,
    });
    expect(readiness.issues).toHaveLength(0);
  });
});
