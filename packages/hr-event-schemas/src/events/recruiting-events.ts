/**
 * Recruiting domain events.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import { HrEventEnvelopeSchema } from '../core/event-envelope.js';

// ------------------------------------------------------------------
// JobRequisitionCreated
// ------------------------------------------------------------------

export interface JobRequisitionCreatedPayload {
  requisitionId: Uuid;
  positionId: Uuid;
  hiringManagerId: Uuid;
  createdBy: Uuid;
}

export const JobRequisitionCreatedPayloadSchema = z.object({
  requisitionId: z.string().uuid(),
  positionId: z.string().uuid(),
  hiringManagerId: z.string().uuid(),
  createdBy: z.string().uuid(),
});

export const JOB_REQUISITION_CREATED = 'JobRequisitionCreated';

export type JobRequisitionCreatedEvent = HrEventEnvelope<JobRequisitionCreatedPayload>;

export function isJobRequisitionCreatedEvent(event: unknown): event is JobRequisitionCreatedEvent {
  const parsed = HrEventEnvelopeSchema(JobRequisitionCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === JOB_REQUISITION_CREATED;
}

// ------------------------------------------------------------------
// JobRequisitionApproved
// ------------------------------------------------------------------

export interface JobRequisitionApprovedPayload {
  requisitionId: Uuid;
  approvedBy: Uuid;
}

export const JobRequisitionApprovedPayloadSchema = z.object({
  requisitionId: z.string().uuid(),
  approvedBy: z.string().uuid(),
});

export const JOB_REQUISITION_APPROVED = 'JobRequisitionApproved';

export type JobRequisitionApprovedEvent = HrEventEnvelope<JobRequisitionApprovedPayload>;

export function isJobRequisitionApprovedEvent(event: unknown): event is JobRequisitionApprovedEvent {
  const parsed = HrEventEnvelopeSchema(JobRequisitionApprovedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === JOB_REQUISITION_APPROVED;
}

// ------------------------------------------------------------------
// JobRequisitionPublished
// ------------------------------------------------------------------

export interface JobRequisitionPublishedPayload {
  requisitionId: Uuid;
  publishedBy: Uuid;
}

export const JobRequisitionPublishedPayloadSchema = z.object({
  requisitionId: z.string().uuid(),
  publishedBy: z.string().uuid(),
});

export const JOB_REQUISITION_PUBLISHED = 'JobRequisitionPublished';

export type JobRequisitionPublishedEvent = HrEventEnvelope<JobRequisitionPublishedPayload>;

export function isJobRequisitionPublishedEvent(event: unknown): event is JobRequisitionPublishedEvent {
  const parsed = HrEventEnvelopeSchema(JobRequisitionPublishedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === JOB_REQUISITION_PUBLISHED;
}

// ------------------------------------------------------------------
// JobRequisitionClosed
// ------------------------------------------------------------------

export interface JobRequisitionClosedPayload {
  requisitionId: Uuid;
  closedBy: Uuid;
  reasonId?: Uuid;
}

export const JobRequisitionClosedPayloadSchema = z.object({
  requisitionId: z.string().uuid(),
  closedBy: z.string().uuid(),
  reasonId: z.string().uuid().optional(),
});

export const JOB_REQUISITION_CLOSED = 'JobRequisitionClosed';

export type JobRequisitionClosedEvent = HrEventEnvelope<JobRequisitionClosedPayload>;

export function isJobRequisitionClosedEvent(event: unknown): event is JobRequisitionClosedEvent {
  const parsed = HrEventEnvelopeSchema(JobRequisitionClosedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === JOB_REQUISITION_CLOSED;
}

// ------------------------------------------------------------------
// CandidateApplicationSubmitted
// ------------------------------------------------------------------

export interface CandidateApplicationSubmittedPayload {
  applicationId: Uuid;
  requisitionId: Uuid;
  candidateId: Uuid;
}

export const CandidateApplicationSubmittedPayloadSchema = z.object({
  applicationId: z.string().uuid(),
  requisitionId: z.string().uuid(),
  candidateId: z.string().uuid(),
});

export const CANDIDATE_APPLICATION_SUBMITTED = 'CandidateApplicationSubmitted';

export type CandidateApplicationSubmittedEvent = HrEventEnvelope<CandidateApplicationSubmittedPayload>;

export function isCandidateApplicationSubmittedEvent(event: unknown): event is CandidateApplicationSubmittedEvent {
  const parsed = HrEventEnvelopeSchema(CandidateApplicationSubmittedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === CANDIDATE_APPLICATION_SUBMITTED;
}

// ------------------------------------------------------------------
// CandidateScreened
// ------------------------------------------------------------------

export interface CandidateScreenedPayload {
  applicationId: Uuid;
  candidateId: Uuid;
  screenedBy: Uuid;
  outcomeId: Uuid;
}

export const CandidateScreenedPayloadSchema = z.object({
  applicationId: z.string().uuid(),
  candidateId: z.string().uuid(),
  screenedBy: z.string().uuid(),
  outcomeId: z.string().uuid(),
});

export const CANDIDATE_SCREENED = 'CandidateScreened';

export type CandidateScreenedEvent = HrEventEnvelope<CandidateScreenedPayload>;

export function isCandidateScreenedEvent(event: unknown): event is CandidateScreenedEvent {
  const parsed = HrEventEnvelopeSchema(CandidateScreenedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === CANDIDATE_SCREENED;
}

// ------------------------------------------------------------------
// CandidateInterviewScheduled
// ------------------------------------------------------------------

export interface CandidateInterviewScheduledPayload {
  applicationId: Uuid;
  candidateId: Uuid;
  interviewId: Uuid;
  scheduledBy: Uuid;
}

export const CandidateInterviewScheduledPayloadSchema = z.object({
  applicationId: z.string().uuid(),
  candidateId: z.string().uuid(),
  interviewId: z.string().uuid(),
  scheduledBy: z.string().uuid(),
});

export const CANDIDATE_INTERVIEW_SCHEDULED = 'CandidateInterviewScheduled';

export type CandidateInterviewScheduledEvent = HrEventEnvelope<CandidateInterviewScheduledPayload>;

export function isCandidateInterviewScheduledEvent(event: unknown): event is CandidateInterviewScheduledEvent {
  const parsed = HrEventEnvelopeSchema(CandidateInterviewScheduledPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === CANDIDATE_INTERVIEW_SCHEDULED;
}

// ------------------------------------------------------------------
// OfferCreated
// ------------------------------------------------------------------

export interface OfferCreatedPayload {
  offerId: Uuid;
  requisitionId: Uuid;
  applicationId: Uuid;
  candidateId: Uuid;
  createdBy: Uuid;
}

export const OfferCreatedPayloadSchema = z.object({
  offerId: z.string().uuid(),
  requisitionId: z.string().uuid(),
  applicationId: z.string().uuid(),
  candidateId: z.string().uuid(),
  createdBy: z.string().uuid(),
});

export const OFFER_CREATED = 'OfferCreated';

export type OfferCreatedEvent = HrEventEnvelope<OfferCreatedPayload>;

export function isOfferCreatedEvent(event: unknown): event is OfferCreatedEvent {
  const parsed = HrEventEnvelopeSchema(OfferCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === OFFER_CREATED;
}

// ------------------------------------------------------------------
// OfferApproved
// ------------------------------------------------------------------

export interface OfferApprovedPayload {
  offerId: Uuid;
  approvedBy: Uuid;
}

export const OfferApprovedPayloadSchema = z.object({
  offerId: z.string().uuid(),
  approvedBy: z.string().uuid(),
});

export const OFFER_APPROVED = 'OfferApproved';

export type OfferApprovedEvent = HrEventEnvelope<OfferApprovedPayload>;

export function isOfferApprovedEvent(event: unknown): event is OfferApprovedEvent {
  const parsed = HrEventEnvelopeSchema(OfferApprovedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === OFFER_APPROVED;
}

// ------------------------------------------------------------------
// OfferAccepted
// ------------------------------------------------------------------

export interface OfferAcceptedPayload {
  // NOTE: these are plain UUID strings at runtime, not `Uuid` instances --
  // `OfferAcceptedPayloadSchema` validates `z.string().uuid()`, and the
  // producer (AcceptOfferHandler's CommandResult.data) sends `.value`
  // strings. A consumer that treats these as `Uuid` objects (e.g. calling
  // `.value` on them, or passing them straight into a repository's
  // `findById(id: Uuid)`) will silently get `undefined` back.
  offerId: string;
  acceptedBy: string;
}

export const OfferAcceptedPayloadSchema = z.object({
  offerId: z.string().uuid(),
  acceptedBy: z.string().uuid(),
});

export const OFFER_ACCEPTED = 'OfferAccepted';

export type OfferAcceptedEvent = HrEventEnvelope<OfferAcceptedPayload>;

export function isOfferAcceptedEvent(event: unknown): event is OfferAcceptedEvent {
  const parsed = HrEventEnvelopeSchema(OfferAcceptedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === OFFER_ACCEPTED;
}

// ------------------------------------------------------------------
// OfferDeclined
// ------------------------------------------------------------------

export interface OfferDeclinedPayload {
  offerId: Uuid;
  declinedBy: Uuid;
  reasonId?: Uuid;
}

export const OfferDeclinedPayloadSchema = z.object({
  offerId: z.string().uuid(),
  declinedBy: z.string().uuid(),
  reasonId: z.string().uuid().optional(),
});

export const OFFER_DECLINED = 'OfferDeclined';

export type OfferDeclinedEvent = HrEventEnvelope<OfferDeclinedPayload>;

export function isOfferDeclinedEvent(event: unknown): event is OfferDeclinedEvent {
  const parsed = HrEventEnvelopeSchema(OfferDeclinedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === OFFER_DECLINED;
}

// ------------------------------------------------------------------
// OfferExpired
// ------------------------------------------------------------------

export interface OfferExpiredPayload {
  offerId: Uuid;
}

export const OfferExpiredPayloadSchema = z.object({
  offerId: z.string().uuid(),
});

export const OFFER_EXPIRED = 'OfferExpired';

export type OfferExpiredEvent = HrEventEnvelope<OfferExpiredPayload>;

export function isOfferExpiredEvent(event: unknown): event is OfferExpiredEvent {
  const parsed = HrEventEnvelopeSchema(OfferExpiredPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === OFFER_EXPIRED;
}

// ------------------------------------------------------------------
// JobRequisitionFilled
// ------------------------------------------------------------------

export interface JobRequisitionFilledPayload {
  // Plain UUID strings at runtime -- see the note on OfferAcceptedPayload
  // above; `JobRequisitionFilledPayloadSchema` validates `z.string().uuid()`
  // and the producer sends `.value` strings.
  requisitionId: string;
  offerId?: string;
}

export const JobRequisitionFilledPayloadSchema = z.object({
  requisitionId: z.string().uuid(),
  offerId: z.string().uuid().optional(),
});

export const JOB_REQUISITION_FILLED = 'JobRequisitionFilled';

export type JobRequisitionFilledEvent = HrEventEnvelope<JobRequisitionFilledPayload>;

export function isJobRequisitionFilledEvent(event: unknown): event is JobRequisitionFilledEvent {
  const parsed = HrEventEnvelopeSchema(JobRequisitionFilledPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === JOB_REQUISITION_FILLED;
}
