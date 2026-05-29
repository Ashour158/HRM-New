import { describe, expect, it } from 'vitest';
import { AttendanceTimesheetProjectionService } from './attendance-timesheet-projection.service.js';
import type { AttendanceDailyLedgerStoredRecord } from '../repositories/attendance-daily-ledger.repository.js';

function snapshot(overrides: Partial<AttendanceDailyLedgerStoredRecord>): AttendanceDailyLedgerStoredRecord {
  return {
    id: 'ledger-1',
    tenantId: '00000000-0000-0000-0000-000000000001',
    workerId: '11111111-1111-1111-1111-111111111111',
    employeeId: 'EMP-001',
    workerName: 'Mona Hassan',
    workDate: '2026-05-25',
    status: 'OUT',
    scheduled: true,
    firstCheckInAt: '2026-05-25T06:30:00.000Z',
    latestCheckOutAt: '2026-05-25T15:00:00.000Z',
    locationStatus: 'WITHIN_GEOFENCE',
    workedMinutes: 510,
    payableMinutes: 480,
    deductionMinutes: 0,
    overtimeMinutes: 30,
    lateMinutes: 0,
    undertimeMinutes: 0,
    exceptionCount: 0,
    readyForPayroll: true,
    locked: true,
    lockedAt: '2026-05-25T20:00:00.000Z',
    lockedBy: 'payroll-admin',
    sourceHash: 'hash',
    payrollPayload: {} as AttendanceDailyLedgerStoredRecord['payrollPayload'],
    ledgerPayload: {} as AttendanceDailyLedgerStoredRecord['ledgerPayload'],
    governance: {} as AttendanceDailyLedgerStoredRecord['governance'],
    createdAt: '2026-05-25T20:00:00.000Z',
    updatedAt: '2026-05-25T20:00:00.000Z',
    ...overrides,
  };
}

describe('AttendanceTimesheetProjectionService', () => {
  const service = new AttendanceTimesheetProjectionService();

  it('builds timesheet entries from locked payroll-ready attendance ledger rows', () => {
    const result = service.projectWorkerTimesheet({
      workerId: '11111111-1111-1111-1111-111111111111',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      snapshots: [
        snapshot({ workDate: '2026-05-25', payableMinutes: 480, status: 'OUT' }),
        snapshot({ id: 'ledger-2', workDate: '2026-05-26', payableMinutes: 240, status: 'ON_LEAVE' }),
        snapshot({ id: 'ledger-3', workDate: '2026-05-27', locked: false, readyForPayroll: true }),
      ],
    });

    expect(result.blockedReasons).toEqual([]);
    expect(result.entries).toEqual([
      { date: new Date('2026-05-25T00:00:00.000Z'), hours: 8, projectCode: 'ATTENDANCE:OUT' },
      { date: new Date('2026-05-26T00:00:00.000Z'), hours: 4, projectCode: 'ATTENDANCE:ON_LEAVE' },
    ]);
    expect(result.totalHours).toBe(12);
  });

  it('returns blockers when no locked payroll-ready rows exist', () => {
    const result = service.projectWorkerTimesheet({
      workerId: '11111111-1111-1111-1111-111111111111',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      snapshots: [snapshot({ readyForPayroll: false, locked: true })],
    });

    expect(result.entries).toEqual([]);
    expect(result.blockedReasons).toContain('No locked payroll-ready attendance ledger rows found for this worker and period.');
  });
});
