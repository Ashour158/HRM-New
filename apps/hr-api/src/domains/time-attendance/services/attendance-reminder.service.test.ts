import { describe, expect, it } from 'vitest';
import { AttendanceReminderService } from './attendance-reminder.service.js';
import type { AttendanceDailyLedger } from './attendance-ledger.service.js';
import type { AttendancePolicy } from './attendance-calculation.service.js';

const policy: AttendancePolicy = {
  standardDailyMinutes: 480,
  flexibleHoursEnabled: false,
  standardStartTime: '09:00',
  standardEndTime: '17:00',
  lateGraceMinutes: 15,
  overtimeAfterMinutes: 480,
  geofenceEnabled: false,
  timezoneOffsetMinutes: 180,
};

function ledger(rows: AttendanceDailyLedger['rows']): AttendanceDailyLedger {
  return {
    workDate: '2026-05-25',
    rows,
    summary: {
      absent: 0,
      exceptions: 0,
      geofenceViolations: 0,
      inProgress: 0,
      late: 0,
      missingCheckout: 0,
      onLeave: 0,
      payrollReady: 0,
      present: 0,
      totalEmployees: rows.length,
      undertime: 0,
    },
    exceptionQueue: [],
  };
}

function row(overrides: Partial<AttendanceDailyLedger['rows'][number]>): AttendanceDailyLedger['rows'][number] {
  return {
    worker: {
      workerId: '11111111-1111-1111-1111-111111111111',
      employeeId: 'EMP-001',
      name: 'Mona Hassan',
      email: 'mona@example.com',
      status: 'ACTIVE',
    },
    workDate: '2026-05-25',
    status: 'ABSENT',
    scheduled: true,
    locationStatus: 'UNKNOWN',
    calculation: {
      workDate: '2026-05-25',
      workedMinutes: 0,
      payableMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      onDutyMinutes: 0,
      absent: true,
      geofenceViolation: false,
      lowTrustPunch: false,
    },
    exceptions: [],
    payrollInput: {
      workDate: '2026-05-25',
      workedMinutes: 0,
      payableMinutes: 0,
      deductionMinutes: 480,
      overtimeMinutes: 0,
      readyForPayroll: false,
      locked: false,
      source: 'ATTENDANCE_DAILY_LEDGER',
    },
    policyEvidence: {
      schedule: { source: 'TENANT_DEFAULT' },
      trust: { minClockTrustScore: 60, lowTrustBlocksPayroll: true },
    },
    governance: {
      visibilityScope: 'HR_ADMIN',
      locationDataClassification: 'CONFIDENTIAL',
      payrollDataClassification: 'CONFIDENTIAL',
    },
    ...overrides,
  };
}

describe('AttendanceReminderService', () => {
  const service = new AttendanceReminderService();

  it('creates late check-in reminders after the grace window', () => {
    const reminders = service.buildReminders({
      ledger: ledger([row({})]),
      policy,
      now: new Date('2026-05-25T06:45:00.000Z'),
    });

    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.type).toBe('LATE_CHECK_IN');
  });

  it('creates missing checkout reminders after scheduled end time', () => {
    const reminders = service.buildReminders({
      ledger: ledger([row({
        status: 'MISSING_CHECKOUT',
        firstCheckInAt: '2026-05-25T06:00:00.000Z',
        payrollInput: {
          workDate: '2026-05-25',
          workedMinutes: 0,
          payableMinutes: 0,
          deductionMinutes: 0,
          overtimeMinutes: 0,
          readyForPayroll: false,
          locked: false,
          source: 'ATTENDANCE_DAILY_LEDGER',
        },
      })]),
      policy,
      now: new Date('2026-05-25T14:30:00.000Z'),
    });

    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.type).toBe('MISSING_CHECK_OUT');
  });
});
