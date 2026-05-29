import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { TimeClockEvent } from '../aggregates/time-clock-event.aggregate.js';
import { AttendanceException } from '../aggregates/attendance-exception.aggregate.js';
import { AttendanceLedgerService, type AttendanceLedgerWorker } from './attendance-ledger.service.js';
import type { AttendancePolicy } from './attendance-calculation.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('11111111-1111-1111-1111-111111111111');

const policy: AttendancePolicy = {
  standardDailyMinutes: 480,
  flexibleHoursEnabled: true,
  flexibleWindowStart: '07:00',
  flexibleWindowEnd: '10:00',
  coreStartTime: '10:00',
  coreEndTime: '15:00',
  standardStartTime: '09:00',
  standardEndTime: '17:00',
  lateGraceMinutes: 15,
  overtimeAfterMinutes: 480,
  geofenceEnabled: true,
  allowedRadiusMeters: 250,
  timezoneOffsetMinutes: 180,
};

const worker: AttendanceLedgerWorker = {
  workerId: workerId.value,
  employeeId: 'EMP-001',
  name: 'Mona Hassan',
  email: 'mona@example.com',
  departmentName: 'Finance',
  managerId: '22222222-2222-2222-2222-222222222222',
  workLocationCode: 'CAIRO_HQ',
  status: 'ACTIVE',
};

function clockEvent(eventType: 'CLOCK_IN' | 'CLOCK_OUT', timestamp: string, location?: Record<string, unknown>) {
  return new TimeClockEvent({
    id: Uuid.generate(),
    tenantId,
    workerId,
    eventType,
    timestamp: new Date(timestamp),
    location: location ? JSON.stringify(location) : undefined,
    deviceId: 'browser',
  });
}

function exception(type: string, description: Record<string, unknown>, status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' = 'OPEN') {
  return new AttendanceException({
    id: Uuid.generate(),
    tenantId,
    workerId,
    exceptionType: type,
    description: JSON.stringify(description),
    detectedAt: new Date('2026-05-25T09:00:00.000Z'),
    status,
  });
}

describe('AttendanceLedgerService', () => {
  const service = new AttendanceLedgerService();

  it('creates an absent exception and payroll deduction for a scheduled workday without events', () => {
    const ledger = service.buildDailyLedger({
      workDate: '2026-05-25',
      workers: [worker],
      eventsByWorkerId: new Map([[worker.workerId, []]]),
      exceptionsByWorkerId: new Map([[worker.workerId, []]]),
      policy,
      holidays: [],
      workDays: [0, 1, 2, 3, 4, 5, 6],
      now: new Date('2026-05-25T12:00:00.000Z'),
    });

    expect(ledger.summary.absent).toBe(1);
    expect(ledger.rows[0]?.status).toBe('ABSENT');
    expect(ledger.rows[0]?.exceptions.map((item) => item.code)).toContain('ABSENCE');
    expect(ledger.rows[0]?.payrollInput.deductionMinutes).toBe(480);
    expect(ledger.rows[0]?.payrollInput.readyForPayroll).toBe(false);
  });

  it('derives late, undertime, and geofence exceptions from clock evidence', () => {
    const ledger = service.buildDailyLedger({
      workDate: '2026-05-25',
      workers: [worker],
      eventsByWorkerId: new Map([[
        worker.workerId,
        [
          clockEvent('CLOCK_IN', '2026-05-25T07:30:00.000Z', {
            workplaceCode: 'CAIRO_HQ',
            distanceMeters: 900,
            latitude: 30,
            longitude: 31,
          }),
          clockEvent('CLOCK_OUT', '2026-05-25T13:00:00.000Z', {
            workplaceCode: 'CAIRO_HQ',
            distanceMeters: 900,
            latitude: 30,
            longitude: 31,
          }),
        ],
      ]]),
      exceptionsByWorkerId: new Map([[worker.workerId, []]]),
      policy,
      holidays: [],
      workDays: [0, 1, 2, 3, 4, 5, 6],
      now: new Date('2026-05-25T14:00:00.000Z'),
    });

    const row = ledger.rows[0];
    expect(row?.status).toBe('GEOFENCE_VIOLATION');
    expect(row?.calculation.workedMinutes).toBe(330);
    expect(row?.calculation.lateMinutes).toBe(15);
    expect(row?.calculation.undertimeMinutes).toBe(150);
    expect(row?.exceptions.map((item) => item.code)).toEqual(expect.arrayContaining(['LATE', 'UNDERTIME', 'GEOFENCE_VIOLATION']));
    expect(row?.payrollInput.deductionMinutes).toBe(165);
  });

  it('keeps missing checkout out of payroll readiness until corrected', () => {
    const ledger = service.buildDailyLedger({
      workDate: '2026-05-25',
      workers: [worker],
      eventsByWorkerId: new Map([[worker.workerId, [clockEvent('CLOCK_IN', '2026-05-25T06:30:00.000Z')]]]),
      exceptionsByWorkerId: new Map([[worker.workerId, []]]),
      policy,
      holidays: [],
      workDays: [0, 1, 2, 3, 4, 5, 6],
      now: new Date('2026-05-25T16:00:00.000Z'),
    });

    expect(ledger.rows[0]?.status).toBe('MISSING_CHECKOUT');
    expect(ledger.rows[0]?.exceptions.map((item) => item.code)).toContain('MISSING_CHECKOUT');
    expect(ledger.rows[0]?.payrollInput.readyForPayroll).toBe(false);
    expect(ledger.summary.missingCheckout).toBe(1);
  });

  it('does not mark absence on holidays or weekends', () => {
    const ledger = service.buildDailyLedger({
      workDate: '2026-05-29',
      workers: [worker],
      eventsByWorkerId: new Map([[worker.workerId, []]]),
      exceptionsByWorkerId: new Map([[worker.workerId, []]]),
      policy,
      holidays: [{ date: '2026-05-29', name: 'Eid Al-Adha' }],
      workDays: [0, 1, 2, 3, 4],
      now: new Date('2026-05-29T12:00:00.000Z'),
    });

    expect(ledger.rows[0]?.status).toBe('HOLIDAY');
    expect(ledger.rows[0]?.exceptions).toHaveLength(0);
    expect(ledger.rows[0]?.payrollInput.payableMinutes).toBe(480);
    expect(ledger.rows[0]?.payrollInput.deductionMinutes).toBe(0);
    expect(ledger.rows[0]?.payrollInput.readyForPayroll).toBe(true);
  });

  it('keeps worked and payable minutes for valid clock events on unscheduled days', () => {
    const ledger = service.buildDailyLedger({
      workDate: '2026-05-29',
      workers: [worker],
      eventsByWorkerId: new Map([[worker.workerId, [
        clockEvent('CLOCK_IN', '2026-05-29T06:00:00.000Z', { trustScore: 95 }),
        clockEvent('CLOCK_OUT', '2026-05-29T14:15:00.000Z', { trustScore: 95 }),
      ]]]),
      exceptionsByWorkerId: new Map([[worker.workerId, []]]),
      policy,
      holidays: [],
      workDays: [0, 1, 2, 3, 4],
      now: new Date('2026-05-29T15:00:00.000Z'),
    });

    const row = ledger.rows[0];
    expect(row?.scheduled).toBe(false);
    expect(row?.status).toBe('OVERTIME');
    expect(row?.calculation.workedMinutes).toBe(495);
    expect(row?.payrollInput.workedMinutes).toBe(495);
    expect(row?.payrollInput.payableMinutes).toBe(495);
    expect(row?.exceptions.map((item) => item.code)).not.toContain('UNDERTIME');
  });

  it('treats approved paid leave as payroll-ready payable time without absence exceptions', () => {
    const ledger = service.buildDailyLedger({
      workDate: '2026-05-25',
      workers: [{
        ...worker,
        approvedLeave: {
          absenceRequestId: 'leave-1',
          absenceType: 'VACATION',
          paid: true,
          startDate: '2026-05-25',
          endDate: '2026-05-25',
        },
      }],
      eventsByWorkerId: new Map([[worker.workerId, []]]),
      exceptionsByWorkerId: new Map([[worker.workerId, []]]),
      policy,
      holidays: [],
      workDays: [0, 1, 2, 3, 4, 5, 6],
      now: new Date('2026-05-25T12:00:00.000Z'),
    });

    const row = ledger.rows[0];
    expect(row?.status).toBe('ON_LEAVE');
    expect(row?.exceptions).toHaveLength(0);
    expect(row?.payrollInput.payableMinutes).toBe(480);
    expect(row?.payrollInput.deductionMinutes).toBe(0);
    expect(row?.payrollInput.readyForPayroll).toBe(true);
    expect(ledger.summary.onLeave).toBe(1);
  });

  it('deducts scheduled time for approved unpaid leave while keeping the row payroll-ready', () => {
    const ledger = service.buildDailyLedger({
      workDate: '2026-05-25',
      workers: [{
        ...worker,
        approvedLeave: {
          absenceRequestId: 'leave-2',
          absenceType: 'UNPAID',
          paid: false,
          startDate: '2026-05-25',
          endDate: '2026-05-25',
        },
      }],
      eventsByWorkerId: new Map([[worker.workerId, []]]),
      exceptionsByWorkerId: new Map([[worker.workerId, []]]),
      policy,
      holidays: [],
      workDays: [0, 1, 2, 3, 4, 5, 6],
      now: new Date('2026-05-25T12:00:00.000Z'),
    });

    const row = ledger.rows[0];
    expect(row?.status).toBe('ON_LEAVE');
    expect(row?.payrollInput.payableMinutes).toBe(0);
    expect(row?.payrollInput.deductionMinutes).toBe(480);
    expect(row?.payrollInput.readyForPayroll).toBe(true);
  });

  it('blocks payroll when an employee clocks time on an approved leave day', () => {
    const ledger = service.buildDailyLedger({
      workDate: '2026-05-25',
      workers: [{
        ...worker,
        approvedLeave: {
          absenceRequestId: 'leave-3',
          absenceType: 'VACATION',
          paid: true,
          startDate: '2026-05-25',
          endDate: '2026-05-25',
        },
      }],
      eventsByWorkerId: new Map([[worker.workerId, [
        clockEvent('CLOCK_IN', '2026-05-25T06:30:00.000Z'),
        clockEvent('CLOCK_OUT', '2026-05-25T15:00:00.000Z'),
      ]]]),
      exceptionsByWorkerId: new Map([[worker.workerId, []]]),
      policy,
      holidays: [],
      workDays: [0, 1, 2, 3, 4, 5, 6],
      now: new Date('2026-05-25T16:00:00.000Z'),
    });

    const row = ledger.rows[0];
    expect(row?.status).toBe('LEAVE_CLOCK_EVENT_CONFLICT');
    expect(row?.exceptions.map((item) => item.code)).toContain('LEAVE_CLOCK_EVENT_CONFLICT');
    expect(row?.payrollInput.readyForPayroll).toBe(false);
  });

  it('surfaces duplicate punches and approval requests in the exception queue', () => {
    const ledger = service.buildDailyLedger({
      workDate: '2026-05-25',
      workers: [worker],
      eventsByWorkerId: new Map([[
        worker.workerId,
        [
          clockEvent('CLOCK_IN', '2026-05-25T06:30:00.000Z'),
          clockEvent('CLOCK_IN', '2026-05-25T06:31:00.000Z'),
        ],
      ]]),
      exceptionsByWorkerId: new Map([[worker.workerId, [
        exception('ON_DUTY_REQUEST', { reason: 'Client visit', startAt: '2026-05-25T07:00:00.000Z', endAt: '2026-05-25T15:00:00.000Z' }),
      ]]]),
      policy,
      holidays: [],
      workDays: [0, 1, 2, 3, 4, 5, 6],
      now: new Date('2026-05-25T10:00:00.000Z'),
    });

    expect(ledger.rows[0]?.exceptions.map((item) => item.code)).toEqual(expect.arrayContaining(['DUPLICATE_PUNCH', 'ON_DUTY_REQUEST']));
    expect(ledger.exceptionQueue).toHaveLength(3);
    expect(ledger.exceptionQueue.map((item) => item.code)).toContain('DUPLICATE_PUNCH');
    expect(ledger.exceptionQueue.map((item) => item.code)).toContain('ON_DUTY_REQUEST');
  });

  it('uses worker-specific holidays and low-trust punch evidence in the approval queue', () => {
    const ledger = service.buildDailyLedger({
      workDate: '2026-05-25',
      workers: [{
        ...worker,
        holiday: { date: '2026-05-25', name: 'Cairo location holiday' },
        effectivePolicy: {
          ...policy,
          minClockTrustScore: 70,
          lowTrustPunchBlocksPayroll: true,
        },
      }],
      eventsByWorkerId: new Map([[worker.workerId, [
        clockEvent('CLOCK_IN', '2026-05-25T06:30:00.000Z', {
          workplaceCode: 'CAIRO_HQ',
          distanceMeters: 80,
          trustScore: 45,
          trustLevel: 'LOW',
          trustReasons: ['UNTRUSTED_DEVICE'],
        }),
        clockEvent('CLOCK_OUT', '2026-05-25T15:00:00.000Z', {
          workplaceCode: 'CAIRO_HQ',
          distanceMeters: 80,
          trustScore: 45,
          trustLevel: 'LOW',
          trustReasons: ['UNTRUSTED_DEVICE'],
        }),
      ]]]),
      exceptionsByWorkerId: new Map([[worker.workerId, []]]),
      policy,
      holidays: [],
      workDays: [0, 1, 2, 3, 4, 5, 6],
    });

    expect(ledger.rows[0]?.status).toBe('HOLIDAY');
    expect(ledger.rows[0]?.holidayName).toBe('Cairo location holiday');
    expect(ledger.rows[0]?.policyEvidence.trust.minClockTrustScore).toBe(70);
    expect(ledger.rows[0]?.exceptions).toHaveLength(0);
  });

  it('requires manager review for low-trust punches on scheduled days', () => {
    const ledger = service.buildDailyLedger({
      workDate: '2026-05-25',
      workers: [{
        ...worker,
        effectivePolicy: {
          ...policy,
          minClockTrustScore: 70,
          lowTrustPunchBlocksPayroll: true,
        },
      }],
      eventsByWorkerId: new Map([[worker.workerId, [
        clockEvent('CLOCK_IN', '2026-05-25T06:30:00.000Z', {
          workplaceCode: 'CAIRO_HQ',
          distanceMeters: 80,
          trustScore: 45,
          trustLevel: 'LOW',
          trustReasons: ['UNTRUSTED_DEVICE'],
        }),
        clockEvent('CLOCK_OUT', '2026-05-25T15:00:00.000Z', {
          workplaceCode: 'CAIRO_HQ',
          distanceMeters: 80,
          trustScore: 45,
          trustLevel: 'LOW',
          trustReasons: ['UNTRUSTED_DEVICE'],
        }),
      ]]]),
      exceptionsByWorkerId: new Map([[worker.workerId, []]]),
      policy,
      holidays: [],
      workDays: [0, 1, 2, 3, 4, 5, 6],
    });

    expect(ledger.rows[0]?.exceptions.map((item) => item.code)).toContain('LOW_TRUST_CLOCK_EVENT');
    expect(ledger.exceptionQueue.map((item) => item.code)).toContain('LOW_TRUST_CLOCK_EVENT');
    expect(ledger.rows[0]?.payrollInput.readyForPayroll).toBe(false);
  });
});
