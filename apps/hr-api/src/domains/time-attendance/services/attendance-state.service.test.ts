import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { TimeClockEvent } from '../aggregates/time-clock-event.aggregate.js';
import { AttendanceStateService } from './attendance-state.service.js';
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
  lateGraceMinutes: 15,
  overtimeAfterMinutes: 480,
  geofenceEnabled: true,
  allowedRadiusMeters: 250,
  timezoneOffsetMinutes: 180,
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

describe('AttendanceStateService', () => {
  const service = new AttendanceStateService();

  it('returns yet-to-check-in state when the employee has no events today', () => {
    const state = service.buildTodayState({
      workerId: workerId.value,
      events: [],
      policy,
      now: new Date('2026-05-25T07:00:00.000Z'),
    });

    expect(state.status).toBe('YET_TO_CHECK_IN');
    expect(state.canCheckIn).toBe(true);
    expect(state.canCheckOut).toBe(false);
    expect(state.elapsedMinutes).toBe(0);
  });

  it('returns active checked-in state with timestamp, timer, and geolocation evidence', () => {
    const state = service.buildTodayState({
      workerId: workerId.value,
      events: [
        clockEvent('CLOCK_IN', '2026-05-25T06:30:00.000Z', {
          latitude: 30.0444,
          longitude: 31.2357,
          accuracyMeters: 14,
          workplaceCode: 'CAIRO_HQ',
          distanceMeters: 88,
        }),
      ],
      policy,
      now: new Date('2026-05-25T09:00:00.000Z'),
    });

    expect(state.status).toBe('IN');
    expect(state.firstCheckInAt).toBe('2026-05-25T06:30:00.000Z');
    expect(state.activeCheckInAt).toBe('2026-05-25T06:30:00.000Z');
    expect(state.elapsedMinutes).toBe(150);
    expect(state.locationStatus).toBe('INSIDE_GEOFENCE');
    expect(state.events).toHaveLength(1);
    expect(state.events[0]?.location?.distanceMeters).toBe(88);
  });

  it('blocks double check-in and check-out before check-in', () => {
    const activeState = service.buildTodayState({
      workerId: workerId.value,
      events: [clockEvent('CLOCK_IN', '2026-05-25T06:30:00.000Z')],
      policy,
      now: new Date('2026-05-25T09:00:00.000Z'),
    });
    const emptyState = service.buildTodayState({
      workerId: workerId.value,
      events: [],
      policy,
      now: new Date('2026-05-25T09:00:00.000Z'),
    });

    expect(service.validateNextEvent(activeState, 'CLOCK_IN')).toEqual({
      allowed: false,
      reason: 'Employee is already checked in.',
    });
    expect(service.validateNextEvent(emptyState, 'CLOCK_OUT')).toEqual({
      allowed: false,
      reason: 'Employee must check in before checking out.',
    });
    expect(service.validateNextEvent(activeState, 'CLOCK_OUT')).toEqual({ allowed: true });
  });
});
