/**
 * Position control & headcount events.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import { HrEventEnvelopeSchema } from '../core/event-envelope.js';

// ------------------------------------------------------------------
// PositionCreated
// ------------------------------------------------------------------

export interface PositionCreatedPayload {
  positionId: Uuid;
  orgUnitId: Uuid;
  jobProfileId: Uuid;
  createdBy: Uuid;
}

export const PositionCreatedPayloadSchema = z.object({
  positionId: z.string().uuid(),
  orgUnitId: z.string().uuid(),
  jobProfileId: z.string().uuid(),
  createdBy: z.string().uuid(),
});

export const POSITION_CREATED = 'PositionCreated';

export type PositionCreatedEvent = HrEventEnvelope<PositionCreatedPayload>;

export function isPositionCreatedEvent(event: unknown): event is PositionCreatedEvent {
  const parsed = HrEventEnvelopeSchema(PositionCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === POSITION_CREATED;
}

// ------------------------------------------------------------------
// PositionActivated
// ------------------------------------------------------------------

export interface PositionActivatedPayload {
  positionId: Uuid;
  activatedBy: Uuid;
}

export const PositionActivatedPayloadSchema = z.object({
  positionId: z.string().uuid(),
  activatedBy: z.string().uuid(),
});

export const POSITION_ACTIVATED = 'PositionActivated';

export type PositionActivatedEvent = HrEventEnvelope<PositionActivatedPayload>;

export function isPositionActivatedEvent(event: unknown): event is PositionActivatedEvent {
  const parsed = HrEventEnvelopeSchema(PositionActivatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === POSITION_ACTIVATED;
}

// ------------------------------------------------------------------
// PositionFrozen
// ------------------------------------------------------------------

export interface PositionFrozenPayload {
  positionId: Uuid;
  frozenBy: Uuid;
  reasonId?: Uuid;
}

export const PositionFrozenPayloadSchema = z.object({
  positionId: z.string().uuid(),
  frozenBy: z.string().uuid(),
  reasonId: z.string().uuid().optional(),
});

export const POSITION_FROZEN = 'PositionFrozen';

export type PositionFrozenEvent = HrEventEnvelope<PositionFrozenPayload>;

export function isPositionFrozenEvent(event: unknown): event is PositionFrozenEvent {
  const parsed = HrEventEnvelopeSchema(PositionFrozenPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === POSITION_FROZEN;
}

// ------------------------------------------------------------------
// PositionFilled
// ------------------------------------------------------------------

export interface PositionFilledPayload {
  positionId: Uuid;
  workerId: Uuid;
  jobAssignmentId: Uuid;
  filledBy: Uuid;
}

export const PositionFilledPayloadSchema = z.object({
  positionId: z.string().uuid(),
  workerId: z.string().uuid(),
  jobAssignmentId: z.string().uuid(),
  filledBy: z.string().uuid(),
});

export const POSITION_FILLED = 'PositionFilled';

export type PositionFilledEvent = HrEventEnvelope<PositionFilledPayload>;

export function isPositionFilledEvent(event: unknown): event is PositionFilledEvent {
  const parsed = HrEventEnvelopeSchema(PositionFilledPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === POSITION_FILLED;
}

// ------------------------------------------------------------------
// PositionVacated
// ------------------------------------------------------------------

export interface PositionVacatedPayload {
  positionId: Uuid;
  workerId: Uuid;
  jobAssignmentId: Uuid;
  vacatedBy: Uuid;
}

export const PositionVacatedPayloadSchema = z.object({
  positionId: z.string().uuid(),
  workerId: z.string().uuid(),
  jobAssignmentId: z.string().uuid(),
  vacatedBy: z.string().uuid(),
});

export const POSITION_VACATED = 'PositionVacated';

export type PositionVacatedEvent = HrEventEnvelope<PositionVacatedPayload>;

export function isPositionVacatedEvent(event: unknown): event is PositionVacatedEvent {
  const parsed = HrEventEnvelopeSchema(PositionVacatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === POSITION_VACATED;
}

// ------------------------------------------------------------------
// PositionClosed
// ------------------------------------------------------------------

export interface PositionClosedPayload {
  positionId: Uuid;
  closedBy: Uuid;
  reasonId?: Uuid;
}

export const PositionClosedPayloadSchema = z.object({
  positionId: z.string().uuid(),
  closedBy: z.string().uuid(),
  reasonId: z.string().uuid().optional(),
});

export const POSITION_CLOSED = 'PositionClosed';

export type PositionClosedEvent = HrEventEnvelope<PositionClosedPayload>;

export function isPositionClosedEvent(event: unknown): event is PositionClosedEvent {
  const parsed = HrEventEnvelopeSchema(PositionClosedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === POSITION_CLOSED;
}

// ------------------------------------------------------------------
// HeadcountRequestSubmitted
// ------------------------------------------------------------------

export interface HeadcountRequestSubmittedPayload {
  headcountRequestId: Uuid;
  orgUnitId: Uuid;
  jobProfileId: Uuid;
  submittedBy: Uuid;
}

export const HeadcountRequestSubmittedPayloadSchema = z.object({
  headcountRequestId: z.string().uuid(),
  orgUnitId: z.string().uuid(),
  jobProfileId: z.string().uuid(),
  submittedBy: z.string().uuid(),
});

export const HEADCOUNT_REQUEST_SUBMITTED = 'HeadcountRequestSubmitted';

export type HeadcountRequestSubmittedEvent = HrEventEnvelope<HeadcountRequestSubmittedPayload>;

export function isHeadcountRequestSubmittedEvent(event: unknown): event is HeadcountRequestSubmittedEvent {
  const parsed = HrEventEnvelopeSchema(HeadcountRequestSubmittedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === HEADCOUNT_REQUEST_SUBMITTED;
}

// ------------------------------------------------------------------
// HeadcountRequestApproved
// ------------------------------------------------------------------

export interface HeadcountRequestApprovedPayload {
  headcountRequestId: Uuid;
  approvedBy: Uuid;
  approvedPositionId?: Uuid;
}

export const HeadcountRequestApprovedPayloadSchema = z.object({
  headcountRequestId: z.string().uuid(),
  approvedBy: z.string().uuid(),
  approvedPositionId: z.string().uuid().optional(),
});

export const HEADCOUNT_REQUEST_APPROVED = 'HeadcountRequestApproved';

export type HeadcountRequestApprovedEvent = HrEventEnvelope<HeadcountRequestApprovedPayload>;

export function isHeadcountRequestApprovedEvent(event: unknown): event is HeadcountRequestApprovedEvent {
  const parsed = HrEventEnvelopeSchema(HeadcountRequestApprovedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === HEADCOUNT_REQUEST_APPROVED;
}

// ------------------------------------------------------------------
// HeadcountRequestRejected
// ------------------------------------------------------------------

export interface HeadcountRequestRejectedPayload {
  headcountRequestId: Uuid;
  rejectedBy: Uuid;
  reasonId?: Uuid;
}

export const HeadcountRequestRejectedPayloadSchema = z.object({
  headcountRequestId: z.string().uuid(),
  rejectedBy: z.string().uuid(),
  reasonId: z.string().uuid().optional(),
});

export const HEADCOUNT_REQUEST_REJECTED = 'HeadcountRequestRejected';

export type HeadcountRequestRejectedEvent = HrEventEnvelope<HeadcountRequestRejectedPayload>;

export function isHeadcountRequestRejectedEvent(event: unknown): event is HeadcountRequestRejectedEvent {
  const parsed = HrEventEnvelopeSchema(HeadcountRequestRejectedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === HEADCOUNT_REQUEST_REJECTED;
}
