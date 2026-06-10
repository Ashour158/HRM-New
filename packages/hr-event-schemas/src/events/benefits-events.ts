/**
 * Benefits domain events.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import { HrEventEnvelopeSchema } from '../core/event-envelope.js';

// ------------------------------------------------------------------
// BenefitsEnrollmentOpened
// ------------------------------------------------------------------

export interface BenefitsEnrollmentOpenedPayload {
  enrollmentId: Uuid;
  enrollmentPeriodId: Uuid;
  openedBy: Uuid;
}

export const BenefitsEnrollmentOpenedPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  enrollmentPeriodId: z.string().uuid(),
  openedBy: z.string().uuid(),
});

export const BENEFITS_ENROLLMENT_OPENED = 'BenefitsEnrollmentOpened';

export type BenefitsEnrollmentOpenedEvent = HrEventEnvelope<BenefitsEnrollmentOpenedPayload>;

export function isBenefitsEnrollmentOpenedEvent(event: unknown): event is BenefitsEnrollmentOpenedEvent {
  const parsed = HrEventEnvelopeSchema(BenefitsEnrollmentOpenedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === BENEFITS_ENROLLMENT_OPENED;
}

// ------------------------------------------------------------------
// BenefitsEnrollmentSubmitted
// ------------------------------------------------------------------

export interface BenefitsEnrollmentSubmittedPayload {
  enrollmentId: Uuid;
  workerId: Uuid;
  programId: Uuid;
}

export const BenefitsEnrollmentSubmittedPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  programId: z.string().uuid(),
});

export const BENEFITS_ENROLLMENT_SUBMITTED = 'BenefitsEnrollmentSubmitted';

export type BenefitsEnrollmentSubmittedEvent = HrEventEnvelope<BenefitsEnrollmentSubmittedPayload>;

export function isBenefitsEnrollmentSubmittedEvent(event: unknown): event is BenefitsEnrollmentSubmittedEvent {
  const parsed = HrEventEnvelopeSchema(BenefitsEnrollmentSubmittedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === BENEFITS_ENROLLMENT_SUBMITTED;
}

// ------------------------------------------------------------------
// BenefitsEnrollmentApproved
// ------------------------------------------------------------------

export interface BenefitsEnrollmentApprovedPayload {
  enrollmentId: Uuid;
  workerId: Uuid;
  approvedBy?: Uuid;
}

export const BenefitsEnrollmentApprovedPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  approvedBy: z.string().uuid().optional(),
});

export const BENEFITS_ENROLLMENT_APPROVED = 'BenefitsEnrollmentApproved';

export type BenefitsEnrollmentApprovedEvent = HrEventEnvelope<BenefitsEnrollmentApprovedPayload>;

export function isBenefitsEnrollmentApprovedEvent(event: unknown): event is BenefitsEnrollmentApprovedEvent {
  const parsed = HrEventEnvelopeSchema(BenefitsEnrollmentApprovedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === BENEFITS_ENROLLMENT_APPROVED;
}

// ------------------------------------------------------------------
// BenefitsEnrollmentTerminated
// ------------------------------------------------------------------

export interface BenefitsEnrollmentTerminatedPayload {
  enrollmentId: Uuid;
  workerId: Uuid;
  reason?: string;
}

export const BenefitsEnrollmentTerminatedPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  reason: z.string().optional(),
});

export const BENEFITS_ENROLLMENT_TERMINATED = 'BenefitsEnrollmentTerminated';

export type BenefitsEnrollmentTerminatedEvent = HrEventEnvelope<BenefitsEnrollmentTerminatedPayload>;

export function isBenefitsEnrollmentTerminatedEvent(event: unknown): event is BenefitsEnrollmentTerminatedEvent {
  const parsed = HrEventEnvelopeSchema(BenefitsEnrollmentTerminatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === BENEFITS_ENROLLMENT_TERMINATED;
}

// ------------------------------------------------------------------
// BenefitsEnrollmentRejected
// ------------------------------------------------------------------

export interface BenefitsEnrollmentRejectedPayload {
  enrollmentId: Uuid;
  workerId: Uuid;
  rejectedBy?: Uuid;
  reason?: string;
}

export const BenefitsEnrollmentRejectedPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  rejectedBy: z.string().uuid().optional(),
  reason: z.string().optional(),
});

export const BENEFITS_ENROLLMENT_REJECTED = 'BenefitsEnrollmentRejected';

export type BenefitsEnrollmentRejectedEvent = HrEventEnvelope<BenefitsEnrollmentRejectedPayload>;

export function isBenefitsEnrollmentRejectedEvent(event: unknown): event is BenefitsEnrollmentRejectedEvent {
  const parsed = HrEventEnvelopeSchema(BenefitsEnrollmentRejectedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === BENEFITS_ENROLLMENT_REJECTED;
}

// ------------------------------------------------------------------
// BenefitsEnrollmentEffective
// ------------------------------------------------------------------

export interface BenefitsEnrollmentEffectivePayload {
  enrollmentId: Uuid;
  workerId: Uuid;
  programId?: Uuid;
  status?: string;
  finalizedBy?: Uuid;
}

export const BenefitsEnrollmentEffectivePayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  programId: z.string().uuid().optional(),
  status: z.string().optional(),
  finalizedBy: z.string().uuid().optional(),
});

export const BENEFITS_ENROLLMENT_EFFECTIVE = 'BenefitsEnrollmentEffective';
export const BENEFITS_ENROLLMENT_FINALIZED = BENEFITS_ENROLLMENT_EFFECTIVE;

export type BenefitsEnrollmentEffectiveEvent = HrEventEnvelope<BenefitsEnrollmentEffectivePayload>;
export type BenefitsEnrollmentFinalizedPayload = BenefitsEnrollmentEffectivePayload;
export type BenefitsEnrollmentFinalizedEvent = BenefitsEnrollmentEffectiveEvent;

export function isBenefitsEnrollmentEffectiveEvent(event: unknown): event is BenefitsEnrollmentEffectiveEvent {
  const parsed = HrEventEnvelopeSchema(BenefitsEnrollmentEffectivePayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === BENEFITS_ENROLLMENT_EFFECTIVE;
}

export const BenefitsEnrollmentFinalizedPayloadSchema = BenefitsEnrollmentEffectivePayloadSchema;

export function isBenefitsEnrollmentFinalizedEvent(event: unknown): event is BenefitsEnrollmentFinalizedEvent {
  return isBenefitsEnrollmentEffectiveEvent(event);
}

// ------------------------------------------------------------------
// BenefitsEnrollmentCancelled
// ------------------------------------------------------------------

export interface BenefitsEnrollmentCancelledPayload {
  enrollmentId: Uuid;
  workerId: Uuid;
  cancelledBy: Uuid;
  reasonId?: Uuid;
}

export const BenefitsEnrollmentCancelledPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  cancelledBy: z.string().uuid(),
  reasonId: z.string().uuid().optional(),
});

export const BENEFITS_ENROLLMENT_CANCELLED = 'BenefitsEnrollmentCancelled';

export type BenefitsEnrollmentCancelledEvent = HrEventEnvelope<BenefitsEnrollmentCancelledPayload>;

export function isBenefitsEnrollmentCancelledEvent(event: unknown): event is BenefitsEnrollmentCancelledEvent {
  const parsed = HrEventEnvelopeSchema(BenefitsEnrollmentCancelledPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === BENEFITS_ENROLLMENT_CANCELLED;
}

// ------------------------------------------------------------------
// DependentAdded
// ------------------------------------------------------------------

export interface DependentAddedPayload {
  dependentId: Uuid;
  workerId: Uuid;
  addedBy: Uuid;
}

export const DependentAddedPayloadSchema = z.object({
  dependentId: z.string().uuid(),
  workerId: z.string().uuid(),
  addedBy: z.string().uuid(),
});

export const DEPENDENT_ADDED = 'DependentAdded';

export type DependentAddedEvent = HrEventEnvelope<DependentAddedPayload>;

export function isDependentAddedEvent(event: unknown): event is DependentAddedEvent {
  const parsed = HrEventEnvelopeSchema(DependentAddedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === DEPENDENT_ADDED;
}

// ------------------------------------------------------------------
// DependentVerified
// ------------------------------------------------------------------

export interface DependentVerifiedPayload {
  dependentId: Uuid;
  workerId: Uuid;
  verifiedBy: Uuid;
}

export const DependentVerifiedPayloadSchema = z.object({
  dependentId: z.string().uuid(),
  workerId: z.string().uuid(),
  verifiedBy: z.string().uuid(),
});

export const DEPENDENT_VERIFIED = 'DependentVerified';

export type DependentVerifiedEvent = HrEventEnvelope<DependentVerifiedPayload>;

export function isDependentVerifiedEvent(event: unknown): event is DependentVerifiedEvent {
  const parsed = HrEventEnvelopeSchema(DependentVerifiedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === DEPENDENT_VERIFIED;
}

// ------------------------------------------------------------------
// LifeEventRecorded
// ------------------------------------------------------------------

export interface LifeEventRecordedPayload {
  lifeEventId: Uuid;
  workerId: Uuid;
  lifeEventTypeId: Uuid;
  recordedBy: Uuid;
}

export const LifeEventRecordedPayloadSchema = z.object({
  lifeEventId: z.string().uuid(),
  workerId: z.string().uuid(),
  lifeEventTypeId: z.string().uuid(),
  recordedBy: z.string().uuid(),
});

export const LIFE_EVENT_RECORDED = 'LifeEventRecorded';

export type LifeEventRecordedEvent = HrEventEnvelope<LifeEventRecordedPayload>;

export function isLifeEventRecordedEvent(event: unknown): event is LifeEventRecordedEvent {
  const parsed = HrEventEnvelopeSchema(LifeEventRecordedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === LIFE_EVENT_RECORDED;
}

// ------------------------------------------------------------------
// LifeEventProcessed
// ------------------------------------------------------------------

export interface LifeEventProcessedPayload {
  lifeEventId: Uuid;
  workerId: Uuid;
  processedBy: Uuid;
}

export const LifeEventProcessedPayloadSchema = z.object({
  lifeEventId: z.string().uuid(),
  workerId: z.string().uuid(),
  processedBy: z.string().uuid(),
});

export const LIFE_EVENT_PROCESSED = 'LifeEventProcessed';

export type LifeEventProcessedEvent = HrEventEnvelope<LifeEventProcessedPayload>;

export function isLifeEventProcessedEvent(event: unknown): event is LifeEventProcessedEvent {
  const parsed = HrEventEnvelopeSchema(LifeEventProcessedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === LIFE_EVENT_PROCESSED;
}

// ------------------------------------------------------------------
// LifeEventRejected
// ------------------------------------------------------------------

export interface LifeEventRejectedPayload {
  lifeEventId: Uuid;
  workerId: Uuid;
  rejectedBy?: Uuid;
  reason?: string;
}

export const LifeEventRejectedPayloadSchema = z.object({
  lifeEventId: z.string().uuid(),
  workerId: z.string().uuid(),
  rejectedBy: z.string().uuid().optional(),
  reason: z.string().optional(),
});

export const LIFE_EVENT_REJECTED = 'LifeEventRejected';

export type LifeEventRejectedEvent = HrEventEnvelope<LifeEventRejectedPayload>;

export function isLifeEventRejectedEvent(event: unknown): event is LifeEventRejectedEvent {
  const parsed = HrEventEnvelopeSchema(LifeEventRejectedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === LIFE_EVENT_REJECTED;
}
