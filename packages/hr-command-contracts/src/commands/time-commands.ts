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
  eventId: Uuid;
  workerId: Uuid;
  clockedAt: Date;
  eventType: 'IN' | 'OUT';
}

export const RecordTimeClockEventPayloadSchema = z.object({
  eventId: z.string().uuid(),
  workerId: z.string().uuid(),
  clockedAt: z.coerce.date(),
  eventType: z.enum(['IN', 'OUT']),
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
