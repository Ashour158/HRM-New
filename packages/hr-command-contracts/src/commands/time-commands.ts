import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Timesheet commands                                                 */
/* ------------------------------------------------------------------ */

export const SubmitTimesheetCommandName = 'SubmitTimesheet' as const;

export interface SubmitTimesheetPayload {
  timesheetId: Uuid;
  workerId: Uuid;
  periodStart: Date;
  periodEnd: Date;
  entries: Array<{
    date: Date;
    hours: number;
    projectCode?: string;
  }>;
}

export const SubmitTimesheetPayloadSchema = z.object({
  timesheetId: z.string().uuid(),
  workerId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  entries: z.array(
    z.object({
      date: z.coerce.date(),
      hours: z.number().nonnegative(),
      projectCode: z.string().optional(),
    })
  ),
});

export const ApproveTimesheetCommandName = 'ApproveTimesheet' as const;

export interface ApproveTimesheetPayload {
  timesheetId: Uuid;
}

export const ApproveTimesheetPayloadSchema = z.object({
  timesheetId: z.string().uuid(),
});

export const RejectTimesheetCommandName = 'RejectTimesheet' as const;

export interface RejectTimesheetPayload {
  timesheetId: Uuid;
  reason: string;
}

export const RejectTimesheetPayloadSchema = z.object({
  timesheetId: z.string().uuid(),
  reason: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/*  Time clock commands                                                */
/* ------------------------------------------------------------------ */

export const RecordTimeClockEventCommandName = 'RecordTimeClockEvent' as const;

export interface RecordTimeClockEventPayload {
  workerId: Uuid;
  timestamp: Date;
  eventType: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  location?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  workplaceCode?: string;
  distanceMeters?: number;
  geofenceRadiusMeters?: number;
  geofenceProfileCode?: string;
  locationStatus?: string;
  deviceTrustLevel?: string;
  trustLevel?: string;
  trustScore?: number;
  trustRequiresApproval?: boolean;
  trustReasons?: string[];
  deviceId?: string;
  captureMethod?: 'API_IMPORT' | 'BIOMETRIC_DEVICE' | 'FACIAL_RECOGNITION' | 'MANUAL_CORRECTION' | 'MOBILE_GEOFENCE' | 'QR_CODE' | 'RFID_CARD' | 'WEB_KIOSK';
  captureDeviceKind?: string;
  captureReference?: string;
  verificationStatus?: 'FAILED' | 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED';
  captureEvidence?: Record<string, unknown>;
}

export const RecordTimeClockEventPayloadSchema = z.object({
  workerId: z.string().uuid(),
  timestamp: z.coerce.date(),
  eventType: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracyMeters: z.number().optional(),
  workplaceCode: z.string().optional(),
  distanceMeters: z.number().optional(),
  geofenceRadiusMeters: z.number().optional(),
  geofenceProfileCode: z.string().optional(),
  locationStatus: z.string().optional(),
  deviceTrustLevel: z.string().optional(),
  trustLevel: z.string().optional(),
  trustScore: z.number().optional(),
  trustRequiresApproval: z.boolean().optional(),
  trustReasons: z.array(z.string()).optional(),
  deviceId: z.string().optional(),
  captureMethod: z.enum(['API_IMPORT', 'BIOMETRIC_DEVICE', 'FACIAL_RECOGNITION', 'MANUAL_CORRECTION', 'MOBILE_GEOFENCE', 'QR_CODE', 'RFID_CARD', 'WEB_KIOSK']).optional(),
  captureDeviceKind: z.string().optional(),
  captureReference: z.string().optional(),
  verificationStatus: z.enum(['FAILED', 'NOT_REQUIRED', 'PENDING', 'VERIFIED']).optional(),
  captureEvidence: z.record(z.unknown()).optional(),
});

/* ------------------------------------------------------------------ */
/*  Attendance exception commands                                      */
/* ------------------------------------------------------------------ */

export const CreateAttendanceExceptionCommandName = 'CreateAttendanceException' as const;

export interface CreateAttendanceExceptionPayload {
  exceptionId: Uuid;
  workerId: Uuid;
  date: Date;
  exceptionType: string;
  reason: string;
}

export const CreateAttendanceExceptionPayloadSchema = z.object({
  exceptionId: z.string().uuid(),
  workerId: z.string().uuid(),
  date: z.coerce.date(),
  exceptionType: z.string().min(1),
  reason: z.string().min(1),
});

export const ResolveAttendanceExceptionCommandName = 'ResolveAttendanceException' as const;

export interface ResolveAttendanceExceptionPayload {
  exceptionId: Uuid;
  resolution: string;
}

export const ResolveAttendanceExceptionPayloadSchema = z.object({
  exceptionId: z.string().uuid(),
  resolution: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/*  Overtime commands                                                  */
/* ------------------------------------------------------------------ */

export const ApproveOvertimeCommandName = 'ApproveOvertime' as const;

export interface ApproveOvertimePayload {
  overtimeRequestId: Uuid;
  workerId: Uuid;
  date: Date;
  hours: number;
}

export const ApproveOvertimePayloadSchema = z.object({
  overtimeRequestId: z.string().uuid(),
  workerId: z.string().uuid(),
  date: z.coerce.date(),
  hours: z.number().positive(),
});
