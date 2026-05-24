/**
 * Time & attendance domain events.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import { HrEventEnvelopeSchema } from '../core/event-envelope.js';

// ------------------------------------------------------------------
// TimesheetSubmitted
// ------------------------------------------------------------------

export interface TimesheetSubmittedPayload {
  timesheetId: Uuid;
  workerId: Uuid;
  periodStartDate: string;
  periodEndDate: string;
}

export const TimesheetSubmittedPayloadSchema = z.object({
  timesheetId: z.string().uuid(),
  workerId: z.string().uuid(),
  periodStartDate: z.string().datetime(),
  periodEndDate: z.string().datetime(),
});

export const TIMESHEET_SUBMITTED = 'TimesheetSubmitted';

export type TimesheetSubmittedEvent = HrEventEnvelope<TimesheetSubmittedPayload>;

export function isTimesheetSubmittedEvent(event: unknown): event is TimesheetSubmittedEvent {
  const parsed = HrEventEnvelopeSchema(TimesheetSubmittedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === TIMESHEET_SUBMITTED;
}

// ------------------------------------------------------------------
// TimesheetApproved
// ------------------------------------------------------------------

export interface TimesheetApprovedPayload {
  timesheetId: Uuid;
  workerId: Uuid;
  approvedBy: Uuid;
}

export const TimesheetApprovedPayloadSchema = z.object({
  timesheetId: z.string().uuid(),
  workerId: z.string().uuid(),
  approvedBy: z.string().uuid(),
});

export const TIMESHEET_APPROVED = 'TimesheetApproved';

export type TimesheetApprovedEvent = HrEventEnvelope<TimesheetApprovedPayload>;

export function isTimesheetApprovedEvent(event: unknown): event is TimesheetApprovedEvent {
  const parsed = HrEventEnvelopeSchema(TimesheetApprovedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === TIMESHEET_APPROVED;
}

// ------------------------------------------------------------------
// TimesheetRejected
// ------------------------------------------------------------------

export interface TimesheetRejectedPayload {
  timesheetId: Uuid;
  workerId: Uuid;
  rejectedBy: Uuid;
  reasonId?: Uuid;
}

export const TimesheetRejectedPayloadSchema = z.object({
  timesheetId: z.string().uuid(),
  workerId: z.string().uuid(),
  rejectedBy: z.string().uuid(),
  reasonId: z.string().uuid().optional(),
});

export const TIMESHEET_REJECTED = 'TimesheetRejected';

export type TimesheetRejectedEvent = HrEventEnvelope<TimesheetRejectedPayload>;

export function isTimesheetRejectedEvent(event: unknown): event is TimesheetRejectedEvent {
  const parsed = HrEventEnvelopeSchema(TimesheetRejectedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === TIMESHEET_REJECTED;
}

// ------------------------------------------------------------------
// TimeClockEventRecorded
// ------------------------------------------------------------------

export interface TimeClockEventRecordedPayload {
  timeClockEventId: Uuid;
  workerId: Uuid;
  timeClockId: Uuid;
  eventTypeId: Uuid;
}

export const TimeClockEventRecordedPayloadSchema = z.object({
  timeClockEventId: z.string().uuid(),
  workerId: z.string().uuid(),
  timeClockId: z.string().uuid(),
  eventTypeId: z.string().uuid(),
});

export const TIME_CLOCK_EVENT_RECORDED = 'TimeClockEventRecorded';

export type TimeClockEventRecordedEvent = HrEventEnvelope<TimeClockEventRecordedPayload>;

export function isTimeClockEventRecordedEvent(event: unknown): event is TimeClockEventRecordedEvent {
  const parsed = HrEventEnvelopeSchema(TimeClockEventRecordedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === TIME_CLOCK_EVENT_RECORDED;
}

// ------------------------------------------------------------------
// AttendanceExceptionCreated
// ------------------------------------------------------------------

export interface AttendanceExceptionCreatedPayload {
  attendanceExceptionId: Uuid;
  workerId: Uuid;
  exceptionTypeId: Uuid;
  createdBy: Uuid;
}

export const AttendanceExceptionCreatedPayloadSchema = z.object({
  attendanceExceptionId: z.string().uuid(),
  workerId: z.string().uuid(),
  exceptionTypeId: z.string().uuid(),
  createdBy: z.string().uuid(),
});

export const ATTENDANCE_EXCEPTION_CREATED = 'AttendanceExceptionCreated';

export type AttendanceExceptionCreatedEvent = HrEventEnvelope<AttendanceExceptionCreatedPayload>;

export function isAttendanceExceptionCreatedEvent(event: unknown): event is AttendanceExceptionCreatedEvent {
  const parsed = HrEventEnvelopeSchema(AttendanceExceptionCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === ATTENDANCE_EXCEPTION_CREATED;
}

// ------------------------------------------------------------------
// AttendanceExceptionResolved
// ------------------------------------------------------------------

export interface AttendanceExceptionResolvedPayload {
  attendanceExceptionId: Uuid;
  workerId: Uuid;
  resolvedBy: Uuid;
  resolutionTypeId: Uuid;
}

export const AttendanceExceptionResolvedPayloadSchema = z.object({
  attendanceExceptionId: z.string().uuid(),
  workerId: z.string().uuid(),
  resolvedBy: z.string().uuid(),
  resolutionTypeId: z.string().uuid(),
});

export const ATTENDANCE_EXCEPTION_RESOLVED = 'AttendanceExceptionResolved';

export type AttendanceExceptionResolvedEvent = HrEventEnvelope<AttendanceExceptionResolvedPayload>;

export function isAttendanceExceptionResolvedEvent(event: unknown): event is AttendanceExceptionResolvedEvent {
  const parsed = HrEventEnvelopeSchema(AttendanceExceptionResolvedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === ATTENDANCE_EXCEPTION_RESOLVED;
}

// ------------------------------------------------------------------
// OvertimeApproved
// ------------------------------------------------------------------

export interface OvertimeApprovedPayload {
  overtimeRequestId: Uuid;
  workerId: Uuid;
  approvedBy: Uuid;
}

export const OvertimeApprovedPayloadSchema = z.object({
  overtimeRequestId: z.string().uuid(),
  workerId: z.string().uuid(),
  approvedBy: z.string().uuid(),
});

export const OVERTIME_APPROVED = 'OvertimeApproved';

export type OvertimeApprovedEvent = HrEventEnvelope<OvertimeApprovedPayload>;

export function isOvertimeApprovedEvent(event: unknown): event is OvertimeApprovedEvent {
  const parsed = HrEventEnvelopeSchema(OvertimeApprovedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === OVERTIME_APPROVED;
}
