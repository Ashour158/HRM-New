/**
 * Base event envelope for the HR/HCM event nervous system.
 *
 * Every event published to the bus must conform to this envelope shape.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import { HrEventPrivacySchema } from './event-privacy.js';
import type { HrEventPrivacy } from './event-privacy.js';

/** Client types that may originate an event. */
export type ClientType = 'EMPLOYEE_PORTAL' | 'MANAGER_PORTAL' | 'HR_ADMIN' | 'MOBILE' | 'BFF' | 'SYSTEM' | 'INTEGRATION';

/** Event envelope metadata block. */
export interface EventMetadata {
  correlationId: Uuid;
  causationId?: Uuid;
  sourceEventId?: Uuid;
  sourceOutboxEventId?: string;
  publicationSource?: 'OUTBOX' | 'DIRECT';
  processInstanceId?: string;
  requestHash: string;
  clientType: ClientType;
  dataResidencyRegion?: string;
  hrDataSensitivity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'RESTRICTED' | 'SPECIAL_CATEGORY';
}

/**
 * Generic event envelope wrapping a domain-specific payload.
 *
 * @typeParam TPayload – the domain payload type (always UUID references, never raw PII)
 */
export interface HrEventEnvelope<TPayload> {
  eventId: Uuid;
  /** Canonical event name: `{Aggregate}{BusinessFactPastTense}` */
  eventName: string;
  eventSchemaVersion: number;
  tenantId: Uuid;
  aggregateType: string;
  aggregateId: Uuid;
  payload: TPayload;
  metadata: EventMetadata;
  privacy: HrEventPrivacy;
  occurredAt: Date;
  version: number;
}

/** Zod schema for the metadata block. */
export const EventMetadataSchema = z.object({
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  sourceEventId: z.string().uuid().optional(),
  sourceOutboxEventId: z.string().uuid().optional(),
  publicationSource: z.enum(['OUTBOX', 'DIRECT']).optional(),
  processInstanceId: z.string().optional(),
  requestHash: z.string().min(1),
  clientType: z.enum(['EMPLOYEE_PORTAL', 'MANAGER_PORTAL', 'HR_ADMIN', 'MOBILE', 'BFF', 'SYSTEM', 'INTEGRATION']),
  dataResidencyRegion: z.string().optional(),
  hrDataSensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'RESTRICTED', 'SPECIAL_CATEGORY']).optional(),
});

/**
 * Factory that produces a Zod schema for a fully-typed event envelope.
 *
 * @param payloadSchema – Zod schema describing the domain payload
 */
export function HrEventEnvelopeSchema<T extends z.ZodTypeAny>(payloadSchema: T) {
  return z.object({
    eventId: z.string().uuid(),
    eventName: z.string().min(1),
    eventSchemaVersion: z.number().int().positive(),
    tenantId: z.string().uuid(),
    aggregateType: z.string().min(1),
    aggregateId: z.string().uuid(),
    payload: payloadSchema,
    metadata: EventMetadataSchema,
    privacy: HrEventPrivacySchema,
    occurredAt: z.coerce.date(),
    version: z.number().int().positive(),
  });
}
