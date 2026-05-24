/**
 * Absence & leave domain events.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import { HrEventEnvelopeSchema } from '../core/event-envelope.js';

// ------------------------------------------------------------------
// AbsenceRequestSubmitted
// ------------------------------------------------------------------

export interface AbsenceRequestSubmittedPayload {
  absenceRequestId: Uuid;
  workerId: Uuid;
  absenceTypeId: Uuid;
}

export const AbsenceRequestSubmittedPayloadSchema = z.object({
  absenceRequestId: z.string().uuid(),
  workerId: z.string().uuid(),
  absenceTypeId: z.string().uuid(),
});

export const ABSENCE_REQUEST_SUBMITTED = 'AbsenceRequestSubmitted';

export type AbsenceRequestSubmittedEvent = HrEventEnvelope<AbsenceRequestSubmittedPayload>;

export function isAbsenceRequestSubmittedEvent(event: unknown): event is AbsenceRequestSubmittedEvent {
  const parsed = HrEventEnvelopeSchema(AbsenceRequestSubmittedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === ABSENCE_REQUEST_SUBMITTED;
}

// ------------------------------------------------------------------
// AbsenceRequestApproved
// ------------------------------------------------------------------

export interface AbsenceRequestApprovedPayload {
  absenceRequestId: Uuid;
  workerId: Uuid;
  approvedBy: Uuid;
}

export const AbsenceRequestApprovedPayloadSchema = z.object({
  absenceRequestId: z.string().uuid(),
  workerId: z.string().uuid(),
  approvedBy: z.string().uuid(),
});

export const ABSENCE_REQUEST_APPROVED = 'AbsenceRequestApproved';

export type AbsenceRequestApprovedEvent = HrEventEnvelope<AbsenceRequestApprovedPayload>;

export function isAbsenceRequestApprovedEvent(event: unknown): event is AbsenceRequestApprovedEvent {
  const parsed = HrEventEnvelopeSchema(AbsenceRequestApprovedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === ABSENCE_REQUEST_APPROVED;
}

// ------------------------------------------------------------------
// AbsenceRequestRejected
// ------------------------------------------------------------------

export interface AbsenceRequestRejectedPayload {
  absenceRequestId: Uuid;
  workerId: Uuid;
  rejectedBy: Uuid;
  reasonId?: Uuid;
}

export const AbsenceRequestRejectedPayloadSchema = z.object({
  absenceRequestId: z.string().uuid(),
  workerId: z.string().uuid(),
  rejectedBy: z.string().uuid(),
  reasonId: z.string().uuid().optional(),
});

export const ABSENCE_REQUEST_REJECTED = 'AbsenceRequestRejected';

export type AbsenceRequestRejectedEvent = HrEventEnvelope<AbsenceRequestRejectedPayload>;

export function isAbsenceRequestRejectedEvent(event: unknown): event is AbsenceRequestRejectedEvent {
  const parsed = HrEventEnvelopeSchema(AbsenceRequestRejectedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === ABSENCE_REQUEST_REJECTED;
}

// ------------------------------------------------------------------
// AbsenceRequestCancelled
// ------------------------------------------------------------------

export interface AbsenceRequestCancelledPayload {
  absenceRequestId: Uuid;
  workerId: Uuid;
  cancelledBy: Uuid;
}

export const AbsenceRequestCancelledPayloadSchema = z.object({
  absenceRequestId: z.string().uuid(),
  workerId: z.string().uuid(),
  cancelledBy: z.string().uuid(),
});

export const ABSENCE_REQUEST_CANCELLED = 'AbsenceRequestCancelled';

export type AbsenceRequestCancelledEvent = HrEventEnvelope<AbsenceRequestCancelledPayload>;

export function isAbsenceRequestCancelledEvent(event: unknown): event is AbsenceRequestCancelledEvent {
  const parsed = HrEventEnvelopeSchema(AbsenceRequestCancelledPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === ABSENCE_REQUEST_CANCELLED;
}

// ------------------------------------------------------------------
// LeaveCaseOpened
// ------------------------------------------------------------------

export interface LeaveCaseOpenedPayload {
  leaveCaseId: Uuid;
  workerId: Uuid;
  leaveTypeId: Uuid;
  openedBy: Uuid;
}

export const LeaveCaseOpenedPayloadSchema = z.object({
  leaveCaseId: z.string().uuid(),
  workerId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  openedBy: z.string().uuid(),
});

export const LEAVE_CASE_OPENED = 'LeaveCaseOpened';

export type LeaveCaseOpenedEvent = HrEventEnvelope<LeaveCaseOpenedPayload>;

export function isLeaveCaseOpenedEvent(event: unknown): event is LeaveCaseOpenedEvent {
  const parsed = HrEventEnvelopeSchema(LeaveCaseOpenedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === LEAVE_CASE_OPENED;
}

// ------------------------------------------------------------------
// LeaveCaseClosed
// ------------------------------------------------------------------

export interface LeaveCaseClosedPayload {
  leaveCaseId: Uuid;
  workerId: Uuid;
  closedBy: Uuid;
  outcomeId?: Uuid;
}

export const LeaveCaseClosedPayloadSchema = z.object({
  leaveCaseId: z.string().uuid(),
  workerId: z.string().uuid(),
  closedBy: z.string().uuid(),
  outcomeId: z.string().uuid().optional(),
});

export const LEAVE_CASE_CLOSED = 'LeaveCaseClosed';

export type LeaveCaseClosedEvent = HrEventEnvelope<LeaveCaseClosedPayload>;

export function isLeaveCaseClosedEvent(event: unknown): event is LeaveCaseClosedEvent {
  const parsed = HrEventEnvelopeSchema(LeaveCaseClosedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === LEAVE_CASE_CLOSED;
}

// ------------------------------------------------------------------
// LeaveEntitlementCalculated
// ------------------------------------------------------------------

export interface LeaveEntitlementCalculatedPayload {
  leaveEntitlementId: Uuid;
  workerId: Uuid;
  leaveTypeId: Uuid;
  calculationRunId: Uuid;
}

export const LeaveEntitlementCalculatedPayloadSchema = z.object({
  leaveEntitlementId: z.string().uuid(),
  workerId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  calculationRunId: z.string().uuid(),
});

export const LEAVE_ENTITLEMENT_CALCULATED = 'LeaveEntitlementCalculated';

export type LeaveEntitlementCalculatedEvent = HrEventEnvelope<LeaveEntitlementCalculatedPayload>;

export function isLeaveEntitlementCalculatedEvent(event: unknown): event is LeaveEntitlementCalculatedEvent {
  const parsed = HrEventEnvelopeSchema(LeaveEntitlementCalculatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === LEAVE_ENTITLEMENT_CALCULATED;
}
