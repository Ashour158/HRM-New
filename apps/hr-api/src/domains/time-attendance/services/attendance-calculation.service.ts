import { Injectable } from '@nestjs/common';

export type AttendanceEventCode =
  | 'ABSENCE'
  | 'GEOFENCE_VIOLATION'
  | 'LATE'
  | 'LOW_TRUST_CLOCK_EVENT'
  | 'ON_DUTY'
  | 'OVERTIME'
  | 'UNDERTIME';

export type AttendanceDeviceTrustLevel = 'BLOCKED' | 'STANDARD' | 'TRUSTED' | 'UNTRUSTED';

export interface AttendanceGeofenceProfile {
  code: string;
  label: string;
  active: boolean;
  locationCode: string;
  radiusMeters: number;
  highAccuracyRequiredMeters?: number;
  requireGeolocation?: boolean;
  blockOutsideGeofence?: boolean;
}

export interface AttendanceDeviceTrustRule {
  code: string;
  label: string;
  active: boolean;
  deviceIdPattern: string;
  trustLevel: AttendanceDeviceTrustLevel;
  requiresApproval?: boolean;
}

export interface AttendancePolicy {
  standardDailyMinutes: number;
  flexibleHoursEnabled: boolean;
  flexibleWindowStart?: string;
  flexibleWindowEnd?: string;
  coreStartTime?: string;
  coreEndTime?: string;
  standardStartTime?: string;
  standardEndTime?: string;
  lateGraceMinutes: number;
  overtimeAfterMinutes: number;
  geofenceEnabled: boolean;
  allowedRadiusMeters?: number;
  timezoneOffsetMinutes?: number;
  workDays?: number[];
  holidays?: Array<{ date: string; name: string }>;
  roundingIncrementMinutes?: number;
  unpaidBreakMinutes?: number;
  missingCheckoutBlocksPayroll?: boolean;
  duplicatePunchBlocksPayroll?: boolean;
  lowTrustPunchBlocksPayroll?: boolean;
  minClockTrustScore?: number;
  minimumPayableDayMinutes?: number;
  geofenceProfiles?: AttendanceGeofenceProfile[];
  deviceTrustRules?: AttendanceDeviceTrustRule[];
}

export interface AttendanceSession {
  checkInAt: Date;
  checkOutAt?: Date;
  distanceMeters?: number;
  trustScore?: number;
}

export interface AttendanceDayCalculationInput {
  workDate: string;
  sessions: AttendanceSession[];
  approvedOnDutyMinutes?: number;
  policy: AttendancePolicy;
  timezoneOffsetMinutes?: number;
}

export interface AttendanceDayCalculation {
  workDate: string;
  workedMinutes: number;
  payableMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  onDutyMinutes: number;
  absent: boolean;
  geofenceViolation: boolean;
  lowTrustPunch: boolean;
  trustScore?: number;
  events: AttendanceEventCode[];
}

export interface AttendanceMonthlySummary {
  workedMinutes: number;
  payableMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  absentDays: number;
  onDutyMinutes: number;
  geofenceViolations: number;
}

function parseClock(value: string | undefined, fallback: string): number {
  const [hours = '0', minutes = '0'] = (value || fallback).split(':');
  return Number(hours) * 60 + Number(minutes);
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0);
}

function roundMinutes(value: number, increment?: number): number {
  if (!increment || increment <= 0) return value;
  return Math.round(value / increment) * increment;
}

function localMinutesOfDay(date: Date, timezoneOffsetMinutes: number): number {
  const shifted = new Date(date.getTime() + timezoneOffsetMinutes * 60000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

@Injectable()
export class AttendanceCalculationService {
  calculateDay(input: AttendanceDayCalculationInput): AttendanceDayCalculation {
    const timezoneOffsetMinutes = input.timezoneOffsetMinutes ?? input.policy.timezoneOffsetMinutes ?? 0;
    const completeSessions = input.sessions.filter((session) => session.checkOutAt);
    const workedMinutes = roundMinutes(completeSessions.reduce(
      (total, session) => total + minutesBetween(session.checkInAt, session.checkOutAt as Date),
      0,
    ), input.policy.roundingIncrementMinutes);
    const onDutyMinutes = input.approvedOnDutyMinutes ?? 0;
    const rawPayableMinutes = workedMinutes + onDutyMinutes;
    const minimumPayableDayMinutes = input.policy.minimumPayableDayMinutes ?? 0;
    const payableMinutes = rawPayableMinutes > 0 && rawPayableMinutes < minimumPayableDayMinutes
      ? minimumPayableDayMinutes
      : rawPayableMinutes;
    const firstCheckIn = input.sessions
      .map((session) => session.checkInAt)
      .sort((left, right) => left.getTime() - right.getTime())[0];

    const lateThreshold = input.policy.flexibleHoursEnabled
      ? parseClock(input.policy.coreStartTime, '10:00') + input.policy.lateGraceMinutes
      : parseClock(input.policy.standardStartTime, '09:00') + input.policy.lateGraceMinutes;
    const firstCheckInMinute = firstCheckIn ? localMinutesOfDay(firstCheckIn, timezoneOffsetMinutes) : undefined;
    const lateMinutes = firstCheckInMinute === undefined
      ? 0
      : Math.max(firstCheckInMinute - lateThreshold, 0);
    const undertimeMinutes = Math.max(input.policy.standardDailyMinutes - payableMinutes, 0);
    const overtimeMinutes = Math.max(payableMinutes - input.policy.overtimeAfterMinutes, 0);
    const geofenceViolation = input.policy.geofenceEnabled && input.policy.allowedRadiusMeters !== undefined
      ? input.sessions.some((session) => (session.distanceMeters ?? 0) > (input.policy.allowedRadiusMeters ?? 0))
      : false;
    const trustScores = input.sessions
      .map((session) => session.trustScore)
      .filter((score): score is number => typeof score === 'number');
    const trustScore = trustScores.length > 0 ? Math.min(...trustScores) : undefined;
    const lowTrustPunch = trustScore !== undefined && trustScore < (input.policy.minClockTrustScore ?? 60);
    const absent = input.sessions.length === 0 && onDutyMinutes === 0;
    const events: AttendanceEventCode[] = [];

    if (absent) events.push('ABSENCE');
    if (lateMinutes > 0) events.push('LATE');
    if (undertimeMinutes > 0) events.push('UNDERTIME');
    if (overtimeMinutes > 0) events.push('OVERTIME');
    if (onDutyMinutes > 0) events.push('ON_DUTY');
    if (geofenceViolation) events.push('GEOFENCE_VIOLATION');
    if (lowTrustPunch) events.push('LOW_TRUST_CLOCK_EVENT');

    return {
      workDate: input.workDate,
      workedMinutes,
      payableMinutes,
      lateMinutes,
      undertimeMinutes,
      overtimeMinutes,
      onDutyMinutes,
      absent,
      geofenceViolation,
      lowTrustPunch,
      trustScore,
      events,
    };
  }

  summarizeMonth(days: AttendanceDayCalculation[]): AttendanceMonthlySummary {
    return days.reduce<AttendanceMonthlySummary>(
      (summary, day) => ({
        workedMinutes: summary.workedMinutes + day.workedMinutes,
        payableMinutes: summary.payableMinutes + day.payableMinutes,
        lateMinutes: summary.lateMinutes + day.lateMinutes,
        undertimeMinutes: summary.undertimeMinutes + day.undertimeMinutes,
        overtimeMinutes: summary.overtimeMinutes + day.overtimeMinutes,
        absentDays: summary.absentDays + (day.absent ? 1 : 0),
        onDutyMinutes: summary.onDutyMinutes + day.onDutyMinutes,
        geofenceViolations: summary.geofenceViolations + (day.geofenceViolation ? 1 : 0),
      }),
      {
        workedMinutes: 0,
        payableMinutes: 0,
        lateMinutes: 0,
        undertimeMinutes: 0,
        overtimeMinutes: 0,
        absentDays: 0,
        onDutyMinutes: 0,
        geofenceViolations: 0,
      },
    );
  }
}
