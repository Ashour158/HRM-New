/**
 * Country policy pack events (blueprint v1.4).
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import { HrEventEnvelopeSchema } from '../core/event-envelope.js';

// ------------------------------------------------------------------
// CountryPolicyPackUploaded
// ------------------------------------------------------------------

export interface CountryPolicyPackUploadedPayload {
  policyPackId: Uuid;
  countryCode: string;
  uploadedBy: Uuid;
}

export const CountryPolicyPackUploadedPayloadSchema = z.object({
  policyPackId: z.string().uuid(),
  countryCode: z.string().length(2),
  uploadedBy: z.string().uuid(),
});

export const COUNTRY_POLICY_PACK_UPLOADED = 'CountryPolicyPackUploaded';

export type CountryPolicyPackUploadedEvent = HrEventEnvelope<CountryPolicyPackUploadedPayload>;

export function isCountryPolicyPackUploadedEvent(event: unknown): event is CountryPolicyPackUploadedEvent {
  const parsed = HrEventEnvelopeSchema(CountryPolicyPackUploadedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === COUNTRY_POLICY_PACK_UPLOADED;
}

// ------------------------------------------------------------------
// CountryPolicyPackValidated
// ------------------------------------------------------------------

export interface CountryPolicyPackValidatedPayload {
  policyPackId: Uuid;
  countryCode: string;
  validationRunId: Uuid;
  validatedBy: Uuid;
}

export const CountryPolicyPackValidatedPayloadSchema = z.object({
  policyPackId: z.string().uuid(),
  countryCode: z.string().length(2),
  validationRunId: z.string().uuid(),
  validatedBy: z.string().uuid(),
});

export const COUNTRY_POLICY_PACK_VALIDATED = 'CountryPolicyPackValidated';

export type CountryPolicyPackValidatedEvent = HrEventEnvelope<CountryPolicyPackValidatedPayload>;

export function isCountryPolicyPackValidatedEvent(event: unknown): event is CountryPolicyPackValidatedEvent {
  const parsed = HrEventEnvelopeSchema(CountryPolicyPackValidatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === COUNTRY_POLICY_PACK_VALIDATED;
}

// ------------------------------------------------------------------
// CountryPolicyPackSimulated
// ------------------------------------------------------------------

export interface CountryPolicyPackSimulatedPayload {
  policyPackId: Uuid;
  countryCode: string;
  simulationRunId: Uuid;
  simulatedBy: Uuid;
}

export const CountryPolicyPackSimulatedPayloadSchema = z.object({
  policyPackId: z.string().uuid(),
  countryCode: z.string().length(2),
  simulationRunId: z.string().uuid(),
  simulatedBy: z.string().uuid(),
});

export const COUNTRY_POLICY_PACK_SIMULATED = 'CountryPolicyPackSimulated';

export type CountryPolicyPackSimulatedEvent = HrEventEnvelope<CountryPolicyPackSimulatedPayload>;

export function isCountryPolicyPackSimulatedEvent(event: unknown): event is CountryPolicyPackSimulatedEvent {
  const parsed = HrEventEnvelopeSchema(CountryPolicyPackSimulatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === COUNTRY_POLICY_PACK_SIMULATED;
}

// ------------------------------------------------------------------
// CountryPolicyPackApproved
// ------------------------------------------------------------------

export interface CountryPolicyPackApprovedPayload {
  policyPackId: Uuid;
  countryCode: string;
  approvedBy: Uuid;
}

export const CountryPolicyPackApprovedPayloadSchema = z.object({
  policyPackId: z.string().uuid(),
  countryCode: z.string().length(2),
  approvedBy: z.string().uuid(),
});

export const COUNTRY_POLICY_PACK_APPROVED = 'CountryPolicyPackApproved';

export type CountryPolicyPackApprovedEvent = HrEventEnvelope<CountryPolicyPackApprovedPayload>;

export function isCountryPolicyPackApprovedEvent(event: unknown): event is CountryPolicyPackApprovedEvent {
  const parsed = HrEventEnvelopeSchema(CountryPolicyPackApprovedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === COUNTRY_POLICY_PACK_APPROVED;
}

// ------------------------------------------------------------------
// CountryPolicyPackPublished
// ------------------------------------------------------------------

export interface CountryPolicyPackPublishedPayload {
  policyPackId: Uuid;
  countryCode: string;
  publishedBy: Uuid;
}

export const CountryPolicyPackPublishedPayloadSchema = z.object({
  policyPackId: z.string().uuid(),
  countryCode: z.string().length(2),
  publishedBy: z.string().uuid(),
});

export const COUNTRY_POLICY_PACK_PUBLISHED = 'CountryPolicyPackPublished';

export type CountryPolicyPackPublishedEvent = HrEventEnvelope<CountryPolicyPackPublishedPayload>;

export function isCountryPolicyPackPublishedEvent(event: unknown): event is CountryPolicyPackPublishedEvent {
  const parsed = HrEventEnvelopeSchema(CountryPolicyPackPublishedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === COUNTRY_POLICY_PACK_PUBLISHED;
}

// ------------------------------------------------------------------
// CountryPolicyPackSuperseded
// ------------------------------------------------------------------

export interface CountryPolicyPackSupersededPayload {
  policyPackId: Uuid;
  countryCode: string;
  supersededByPolicyPackId: Uuid;
  supersededBy: Uuid;
}

export const CountryPolicyPackSupersededPayloadSchema = z.object({
  policyPackId: z.string().uuid(),
  countryCode: z.string().length(2),
  supersededByPolicyPackId: z.string().uuid(),
  supersededBy: z.string().uuid(),
});

export const COUNTRY_POLICY_PACK_SUPERSEDED = 'CountryPolicyPackSuperseded';

export type CountryPolicyPackSupersededEvent = HrEventEnvelope<CountryPolicyPackSupersededPayload>;

export function isCountryPolicyPackSupersededEvent(event: unknown): event is CountryPolicyPackSupersededEvent {
  const parsed = HrEventEnvelopeSchema(CountryPolicyPackSupersededPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === COUNTRY_POLICY_PACK_SUPERSEDED;
}

// ------------------------------------------------------------------
// CountryPolicyPackRolledBack
// ------------------------------------------------------------------

export interface CountryPolicyPackRolledBackPayload {
  policyPackId: Uuid;
  countryCode: string;
  rolledBackBy: Uuid;
  restoredPolicyPackId: Uuid;
}

export const CountryPolicyPackRolledBackPayloadSchema = z.object({
  policyPackId: z.string().uuid(),
  countryCode: z.string().length(2),
  rolledBackBy: z.string().uuid(),
  restoredPolicyPackId: z.string().uuid(),
});

export const COUNTRY_POLICY_PACK_ROLLED_BACK = 'CountryPolicyPackRolledBack';

export type CountryPolicyPackRolledBackEvent = HrEventEnvelope<CountryPolicyPackRolledBackPayload>;

export function isCountryPolicyPackRolledBackEvent(event: unknown): event is CountryPolicyPackRolledBackEvent {
  const parsed = HrEventEnvelopeSchema(CountryPolicyPackRolledBackPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === COUNTRY_POLICY_PACK_ROLLED_BACK;
}
