import { describe, expect, it } from 'vitest';
import {
  AttendanceCalculationService,
  type AttendancePolicy,
  type AttendanceSession,
} from './attendance-calculation.service.js';

const policy: AttendancePolicy = {
  standardDailyMinutes: 480,
  flexibleHoursEnabled: true,
  flexibleWindowStart: '07:00',
  flexibleWindowEnd: '10:00',
  coreStartTime: '10:00',
  coreEndTime: '15:00',
  lateGraceMinutes: 15,
  overtimeAfterMinutes: 480,
  geofenceEnabled: true,
  allowedRadiusMeters: 250,
};

function session(checkInAt: string, checkOutAt: string): AttendanceSession {
  return {
    checkInAt: new Date(checkInAt),
    checkOutAt: new Date(checkOutAt),
    distanceMeters: 120,
  };
}

describe('AttendanceCalculationService', () => {
  const service = new AttendanceCalculationService();

  it('honors flexible hours and calculates overtime from worked minutes', () => {
    const result = service.calculateDay({
      workDate: '2026-05-25',
      sessions: [session('2026-05-25T06:20:00.000Z', '2026-05-25T15:00:00.000Z')],
      policy,
      timezoneOffsetMinutes: 180,
    });

    expect(result.workedMinutes).toBe(520);
    expect(result.lateMinutes).toBe(0);
    expect(result.overtimeMinutes).toBe(40);
    expect(result.events).toContain('OVERTIME');
  });

  it('applies late grace and undertime when the core day is missed', () => {
    const result = service.calculateDay({
      workDate: '2026-05-25',
      sessions: [session('2026-05-25T07:30:00.000Z', '2026-05-25T13:00:00.000Z')],
      policy,
      timezoneOffsetMinutes: 180,
    });

    expect(result.workedMinutes).toBe(330);
    expect(result.lateMinutes).toBe(15);
    expect(result.undertimeMinutes).toBe(150);
    expect(result.events).toEqual(expect.arrayContaining(['LATE', 'UNDERTIME']));
  });

  it('adds approved on-duty minutes and flags geofence violations', () => {
    const result = service.calculateDay({
      workDate: '2026-05-25',
      sessions: [{
        checkInAt: new Date('2026-05-25T07:00:00.000Z'),
        checkOutAt: new Date('2026-05-25T11:00:00.000Z'),
        distanceMeters: 900,
      }],
      approvedOnDutyMinutes: 120,
      policy,
      timezoneOffsetMinutes: 180,
    });

    expect(result.workedMinutes).toBe(240);
    expect(result.payableMinutes).toBe(360);
    expect(result.geofenceViolation).toBe(true);
    expect(result.events).toContain('GEOFENCE_VIOLATION');
  });

  it('honors minimum payable flexible day and low-trust punch policy', () => {
    const result = service.calculateDay({
      workDate: '2026-05-25',
      sessions: [{
        checkInAt: new Date('2026-05-25T06:00:00.000Z'),
        checkOutAt: new Date('2026-05-25T08:00:00.000Z'),
        trustScore: 45,
      }],
      policy: {
        ...policy,
        minimumPayableDayMinutes: 240,
        minClockTrustScore: 70,
      },
    });

    expect(result.workedMinutes).toBe(120);
    expect(result.payableMinutes).toBe(240);
    expect(result.lowTrustPunch).toBe(true);
    expect(result.events).toContain('LOW_TRUST_CLOCK_EVENT');
  });
});
