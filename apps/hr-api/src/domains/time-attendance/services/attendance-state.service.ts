import { Injectable } from '@nestjs/common';
import type { TimeClockEvent, TimeClockEventType } from '../aggregates/time-clock-event.aggregate.js';
import type { AttendancePolicy } from './attendance-calculation.service.js';

export type AttendanceClockStatus =
  | 'YET_TO_CHECK_IN'
  | 'IN'
  | 'OUT'
  | 'MISSING_CHECKOUT'
  | 'OUTSIDE_GEOFENCE';

export type AttendanceLocationStatus =
  | 'INSIDE_GEOFENCE'
  | 'NO_GEOLOCATION'
  | 'OUTSIDE_GEOFENCE'
  | 'UNKNOWN_WORKPLACE';

export interface ClockLocationEvidence {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  workplaceCode?: string;
  distanceMeters?: number;
  locationStatus?: AttendanceLocationStatus;
  deviceTrustLevel?: string;
  trustLevel?: string;
  trustScore?: number;
  trustRequiresApproval?: boolean;
  trustReasons?: string[];
}

export interface AttendanceTimelineEvent {
  id: string;
  eventType: TimeClockEventType;
  timestamp: string;
  status: string;
  deviceId?: string;
  location?: ClockLocationEvidence;
  locationStatus: AttendanceLocationStatus;
  deviceTrustLevel?: string;
  trustLevel?: string;
  trustScore?: number;
  trustReasons?: string[];
}

export interface AttendanceTodayState {
  workerId: string;
  workDate: string;
  status: AttendanceClockStatus;
  canCheckIn: boolean;
  canCheckOut: boolean;
  firstCheckInAt?: string;
  latestCheckOutAt?: string;
  activeCheckInAt?: string;
  elapsedMinutes: number;
  totalWorkedMinutes: number;
  locationStatus: AttendanceLocationStatus;
  events: AttendanceTimelineEvent[];
}

function parseLocation(value?: string): ClockLocationEvidence | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as ClockLocationEvidence;
  } catch {
    return undefined;
  }
}

function locationStatus(location: ClockLocationEvidence | undefined, policy: AttendancePolicy): AttendanceLocationStatus {
  if (location?.locationStatus) return location.locationStatus;
  if (!policy.geofenceEnabled) return 'UNKNOWN_WORKPLACE';
  if (!location || (location.latitude === undefined && location.longitude === undefined)) return 'NO_GEOLOCATION';
  if (location.distanceMeters === undefined || policy.allowedRadiusMeters === undefined) return 'UNKNOWN_WORKPLACE';
  return location.distanceMeters > policy.allowedRadiusMeters ? 'OUTSIDE_GEOFENCE' : 'INSIDE_GEOFENCE';
}

function localDateKey(date: Date, timezoneOffsetMinutes: number): string {
  return new Date(date.getTime() + timezoneOffsetMinutes * 60000).toISOString().slice(0, 10);
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0);
}

@Injectable()
export class AttendanceStateService {
  buildTodayState(input: {
    workerId: string;
    events: TimeClockEvent[];
    policy: AttendancePolicy;
    now?: Date;
    workDate?: string;
  }): AttendanceTodayState {
    const now = input.now ?? new Date();
    const timezoneOffsetMinutes = input.policy.timezoneOffsetMinutes ?? 0;
    const workDate = input.workDate ?? localDateKey(now, timezoneOffsetMinutes);
    const sortedEvents = [...input.events].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
    const todayEvents = sortedEvents.filter((event) => localDateKey(event.timestamp, timezoneOffsetMinutes) === workDate);
    const timeline = todayEvents.map((event) => {
      const location = parseLocation(event.location);
      return {
        id: event.id.value,
        eventType: event.eventType,
        timestamp: event.timestamp.toISOString(),
        status: event.status,
        deviceId: event.deviceId,
        location,
        locationStatus: locationStatus(location, input.policy),
        deviceTrustLevel: location?.deviceTrustLevel,
        trustLevel: location?.trustLevel,
        trustScore: location?.trustScore,
        trustReasons: location?.trustReasons,
      };
    });

    const previousEvents = sortedEvents.filter((event) => localDateKey(event.timestamp, timezoneOffsetMinutes) < workDate);
    const previousOpenCheckIn = previousEvents.length > 0 && previousEvents[previousEvents.length - 1]?.eventType === 'CLOCK_IN';

    let firstCheckInAt: string | undefined;
    let latestCheckOutAt: string | undefined;
    let activeCheckIn: TimeClockEvent | undefined;
    let totalWorkedMinutes = 0;

    for (const event of todayEvents) {
      if (event.eventType === 'CLOCK_IN') {
        firstCheckInAt ??= event.timestamp.toISOString();
        activeCheckIn = event;
      }
      if (event.eventType === 'CLOCK_OUT') {
        latestCheckOutAt = event.timestamp.toISOString();
        if (activeCheckIn) {
          totalWorkedMinutes += minutesBetween(activeCheckIn.timestamp, event.timestamp);
          activeCheckIn = undefined;
        }
      }
    }

    const elapsedMinutes = activeCheckIn ? minutesBetween(activeCheckIn.timestamp, now) : 0;
    if (activeCheckIn) totalWorkedMinutes += elapsedMinutes;

    const activeLocationStatus = activeCheckIn
      ? locationStatus(parseLocation(activeCheckIn.location), input.policy)
      : timeline[timeline.length - 1]?.locationStatus ?? (previousOpenCheckIn ? 'NO_GEOLOCATION' : 'NO_GEOLOCATION');

    const status: AttendanceClockStatus = activeCheckIn
      ? activeLocationStatus === 'OUTSIDE_GEOFENCE'
        ? 'OUTSIDE_GEOFENCE'
        : 'IN'
      : todayEvents.length > 0
        ? 'OUT'
        : previousOpenCheckIn
          ? 'MISSING_CHECKOUT'
          : 'YET_TO_CHECK_IN';

    return {
      workerId: input.workerId,
      workDate,
      status,
      canCheckIn: status === 'YET_TO_CHECK_IN' || status === 'OUT',
      canCheckOut: status === 'IN' || status === 'OUTSIDE_GEOFENCE',
      firstCheckInAt,
      latestCheckOutAt,
      activeCheckInAt: activeCheckIn?.timestamp.toISOString(),
      elapsedMinutes,
      totalWorkedMinutes,
      locationStatus: activeLocationStatus,
      events: timeline,
    };
  }

  validateNextEvent(
    state: AttendanceTodayState,
    eventType: Extract<TimeClockEventType, 'CLOCK_IN' | 'CLOCK_OUT'>,
  ): { allowed: true } | { allowed: false; reason: string } {
    if (eventType === 'CLOCK_IN' && !state.canCheckIn) {
      return {
        allowed: false,
        reason: state.status === 'MISSING_CHECKOUT'
          ? 'Employee has a missing checkout that must be corrected before a new check-in.'
          : 'Employee is already checked in.',
      };
    }
    if (eventType === 'CLOCK_OUT' && !state.canCheckOut) {
      return { allowed: false, reason: 'Employee must check in before checking out.' };
    }
    return { allowed: true };
  }
}
