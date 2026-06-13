import { describe, expect, it } from 'vitest';
import { AttendanceFinalizationService } from './attendance-finalization.service.js';
import type { AttendanceDailyLedger } from './attendance-ledger.service.js';

function ledgerFixture(overrides: Partial<AttendanceDailyLedger['rows'][number]> = {}): AttendanceDailyLedger {
  const row: AttendanceDailyLedger['rows'][number] = {
    worker: {
      workerId: 'worker-1',
      employeeId: 'EMP-1',
      name: 'Employee One',
      email: 'employee.one@example.com',
      departmentName: 'Operations',
      workLocationCode: 'CAIRO_HQ',
      status: 'ACTIVE',
    },
    workDate: '2026-05-26',
    status: 'HOLIDAY',
    scheduled: false,
    holidayName: 'Eid Al-Adha',
    locationStatus: 'NO_GEOLOCATION',
    calculation: {
      workDate: '2026-05-26',
      workedMinutes: 0,
      payableMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      onDutyMinutes: 0,
      absent: false,
      geofenceViolation: false,
      events: [],
    },
    exceptions: [],
    payrollInput: {
      workDate: '2026-05-26',
      workedMinutes: 0,
      payableMinutes: 0,
      deductionMinutes: 0,
      overtimeMinutes: 0,
      readyForPayroll: true,
      locked: false,
      source: 'ATTENDANCE_DAILY_LEDGER',
    },
    governance: {
      visibilityScope: 'HR_ADMIN',
      locationDataClassification: 'CONFIDENTIAL',
      payrollDataClassification: 'CONFIDENTIAL',
    },
    ...overrides,
  };

  return {
    workDate: '2026-05-26',
    rows: [row],
    summary: {
      absent: row.status === 'ABSENT' ? 1 : 0,
      exceptions: row.exceptions.length,
      geofenceViolations: 0,
      inProgress: 0,
      late: 0,
      missingCheckout: 0,
      payrollReady: row.payrollInput.readyForPayroll ? 1 : 0,
      present: 0,
      totalEmployees: 1,
      undertime: 0,
    },
    exceptionQueue: [],
  };
}

describe('AttendanceFinalizationService', () => {
  const service = new AttendanceFinalizationService();

  it('refuses to finalize a ledger while payroll-blocking rows remain', () => {
    const result = service.finalizeDailyLedger(ledgerFixture({
      status: 'ABSENT',
      scheduled: true,
      payrollInput: {
        workDate: '2026-05-26',
        workedMinutes: 0,
        payableMinutes: 0,
        deductionMinutes: 480,
        overtimeMinutes: 0,
        readyForPayroll: false,
        locked: false,
        source: 'ATTENDANCE_DAILY_LEDGER',
      },
    }), {
      tenantId: 'tenant-1',
      lockedBy: 'payroll-admin',
      payrollCycleId: 'cycle-1',
      lockedAt: new Date('2026-05-27T08:00:00Z'),
    });

    expect(result.canFinalize).toBe(false);
    expect(result.blockedRows).toHaveLength(1);
    expect(result.snapshots).toHaveLength(0);
    expect(result.payrollInputs).toHaveLength(0);
  });

  it('locks clean rows and produces payroll handoff inputs', () => {
    const lockedAt = new Date('2026-05-27T08:00:00Z');
    const result = service.finalizeDailyLedger(ledgerFixture(), {
      tenantId: 'tenant-1',
      lockedBy: 'payroll-admin',
      payrollCycleId: 'cycle-1',
      lockedAt,
      currency: 'EGP',
    });

    expect(result.canFinalize).toBe(true);
    expect(result.blockedRows).toHaveLength(0);
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0]).toMatchObject({
      tenantId: 'tenant-1',
      workerId: 'worker-1',
      workDate: '2026-05-26',
      status: 'HOLIDAY',
      readyForPayroll: true,
      locked: true,
      lockedBy: 'payroll-admin',
      payrollCycleId: 'cycle-1',
      payrollPayload: {
        workedMinutes: 0,
        payableMinutes: 0,
        deductionMinutes: 0,
        overtimeMinutes: 0,
      },
    });
    expect(result.snapshots[0]?.lockedAt).toEqual(lockedAt);
    expect(result.payrollInputs).toEqual([
      {
        tenantId: 'tenant-1',
        workerId: 'worker-1',
        payrollCycleId: 'cycle-1',
        inputType: 'ATTENDANCE_DAILY_LEDGER',
        amount: 0,
        currency: 'EGP',
        description: 'Attendance 2026-05-26: payable 0m, deduction 0m, overtime 0m',
      },
    ]);
  });
});
