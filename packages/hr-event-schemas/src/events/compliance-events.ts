/**
 * Compliance & policy domain events.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import { HrEventEnvelopeSchema } from '../core/event-envelope.js';

// ------------------------------------------------------------------
// PolicyDocumentPublished
// ------------------------------------------------------------------

export interface PolicyDocumentPublishedPayload {
  policyDocumentId: Uuid;
  policyVersionId: Uuid;
  legalEntityId?: Uuid;
  publishedBy: Uuid;
}

export const PolicyDocumentPublishedPayloadSchema = z.object({
  policyDocumentId: z.string().uuid(),
  policyVersionId: z.string().uuid(),
  legalEntityId: z.string().uuid().optional(),
  publishedBy: z.string().uuid(),
});

export const POLICY_DOCUMENT_PUBLISHED = 'PolicyDocumentPublished';

export type PolicyDocumentPublishedEvent = HrEventEnvelope<PolicyDocumentPublishedPayload>;

export function isPolicyDocumentPublishedEvent(event: unknown): event is PolicyDocumentPublishedEvent {
  const parsed = HrEventEnvelopeSchema(PolicyDocumentPublishedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === POLICY_DOCUMENT_PUBLISHED;
}

// ------------------------------------------------------------------
// PolicyAcknowledgementRequired
// ------------------------------------------------------------------

export interface PolicyAcknowledgementRequiredPayload {
  policyAcknowledgementId: Uuid;
  policyDocumentId: Uuid;
  workerId: Uuid;
}

export const PolicyAcknowledgementRequiredPayloadSchema = z.object({
  policyAcknowledgementId: z.string().uuid(),
  policyDocumentId: z.string().uuid(),
  workerId: z.string().uuid(),
});

export const POLICY_ACKNOWLEDGEMENT_REQUIRED = 'PolicyAcknowledgementRequired';

export type PolicyAcknowledgementRequiredEvent = HrEventEnvelope<PolicyAcknowledgementRequiredPayload>;

export function isPolicyAcknowledgementRequiredEvent(event: unknown): event is PolicyAcknowledgementRequiredEvent {
  const parsed = HrEventEnvelopeSchema(PolicyAcknowledgementRequiredPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === POLICY_ACKNOWLEDGEMENT_REQUIRED;
}

// ------------------------------------------------------------------
// PolicyAcknowledged
// ------------------------------------------------------------------

export interface PolicyAcknowledgedPayload {
  policyAcknowledgementId: Uuid;
  policyDocumentId: Uuid;
  workerId: Uuid;
}

export const PolicyAcknowledgedPayloadSchema = z.object({
  policyAcknowledgementId: z.string().uuid(),
  policyDocumentId: z.string().uuid(),
  workerId: z.string().uuid(),
});

export const POLICY_ACKNOWLEDGED = 'PolicyAcknowledged';

export type PolicyAcknowledgedEvent = HrEventEnvelope<PolicyAcknowledgedPayload>;

export function isPolicyAcknowledgedEvent(event: unknown): event is PolicyAcknowledgedEvent {
  const parsed = HrEventEnvelopeSchema(PolicyAcknowledgedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === POLICY_ACKNOWLEDGED;
}

// ------------------------------------------------------------------
// LegalHoldPlaced
// ------------------------------------------------------------------

export interface LegalHoldPlacedPayload {
  legalHoldId: Uuid;
  workerId: Uuid;
  placedBy: Uuid;
}

export const LegalHoldPlacedPayloadSchema = z.object({
  legalHoldId: z.string().uuid(),
  workerId: z.string().uuid(),
  placedBy: z.string().uuid(),
});

export const LEGAL_HOLD_PLACED = 'LegalHoldPlaced';

export type LegalHoldPlacedEvent = HrEventEnvelope<LegalHoldPlacedPayload>;

export function isLegalHoldPlacedEvent(event: unknown): event is LegalHoldPlacedEvent {
  const parsed = HrEventEnvelopeSchema(LegalHoldPlacedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === LEGAL_HOLD_PLACED;
}

// ------------------------------------------------------------------
// LegalHoldReleased
// ------------------------------------------------------------------

export interface LegalHoldReleasedPayload {
  legalHoldId: Uuid;
  workerId: Uuid;
  releasedBy: Uuid;
}

export const LegalHoldReleasedPayloadSchema = z.object({
  legalHoldId: z.string().uuid(),
  workerId: z.string().uuid(),
  releasedBy: z.string().uuid(),
});

export const LEGAL_HOLD_RELEASED = 'LegalHoldReleased';

export type LegalHoldReleasedEvent = HrEventEnvelope<LegalHoldReleasedPayload>;

export function isLegalHoldReleasedEvent(event: unknown): event is LegalHoldReleasedEvent {
  const parsed = HrEventEnvelopeSchema(LegalHoldReleasedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === LEGAL_HOLD_RELEASED;
}

// ------------------------------------------------------------------
// StatutoryReportSubmitted
// ------------------------------------------------------------------

export interface StatutoryReportSubmittedPayload {
  reportId: Uuid;
  legalEntityId: Uuid;
  reportTypeId: Uuid;
  submittedBy: Uuid;
}

export const StatutoryReportSubmittedPayloadSchema = z.object({
  reportId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
  reportTypeId: z.string().uuid(),
  submittedBy: z.string().uuid(),
});

export const STATUTORY_REPORT_SUBMITTED = 'StatutoryReportSubmitted';

export type StatutoryReportSubmittedEvent = HrEventEnvelope<StatutoryReportSubmittedPayload>;

export function isStatutoryReportSubmittedEvent(event: unknown): event is StatutoryReportSubmittedEvent {
  const parsed = HrEventEnvelopeSchema(StatutoryReportSubmittedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === STATUTORY_REPORT_SUBMITTED;
}
