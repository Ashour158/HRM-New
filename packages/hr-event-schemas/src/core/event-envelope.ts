/**
 * Base event envelope for the HR/HCM event nervous system.
 *
 * Every event published to the bus must conform to this envelope shape.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import { HrEventPrivacySchema } from './event-privacy.js';
import type { HrEventPrivacy } from './event-privacy.js';

/**
 * Zod schema for a UUID-typed envelope field that may arrive in any of the
 * three shapes this field actually takes at runtime, despite every
 * `HrEventEnvelope`/`EventMetadata` field being typed `Uuid` in TypeScript:
 *
 *  1. A real {@link Uuid} instance — e.g. `createEvent()` and
 *     `outboxRowToEnvelope()` build envelopes this way, and `InMemoryEventBus`
 *     hands that same object straight to subscribers with no serialization.
 *  2. A raw UUID string — e.g. hand-built envelopes/tests, or anything that
 *     already unwrapped `.value`.
 *  3. A plain `{ value: string }` object — what a `Uuid` instance turns into
 *     after `KafkaEventBus` round-trips it through `JSON.stringify`/`JSON.parse`
 *     (`Uuid` has no `toJSON`, so JSON serialization keeps only its own
 *     enumerable `value` property).
 *
 * Without normalizing all three shapes to a plain string first, `z.string().uuid()`
 * rejects every one of them except accidentally-already-unwrapped strings —
 * which meant every `isXEvent` guard built via {@link HrEventEnvelopeSchema}
 * never actually matched a real, transport-delivered event.
 */
function uuidLikeSchema() {
  return z.preprocess((value) => {
    if (typeof value === 'string') return value;
    if (
      value &&
      typeof value === 'object' &&
      'value' in value &&
      typeof (value as { value: unknown }).value === 'string'
    ) {
      return (value as { value: string }).value;
    }
    return value;
  }, z.string().uuid());
}

/** Client types that may originate an event. */
export type ClientType = 'EMPLOYEE_PORTAL' | 'MANAGER_PORTAL' | 'HR_ADMIN' | 'MOBILE' | 'BFF' | 'SYSTEM' | 'SYSTEM_SCHEDULER' | 'INTEGRATION';

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
  /** Topic captured at initial outbox write time so replay does not drift if routing rules change. */
  topic?: string;
  /** Event schema version captured at initial outbox write time. */
  eventSchemaVersion?: number;
  /** Envelope version captured at initial outbox write time. */
  envelopeVersion?: number;
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
  correlationId: uuidLikeSchema(),
  causationId: uuidLikeSchema().optional(),
  sourceEventId: uuidLikeSchema().optional(),
  sourceOutboxEventId: z.string().uuid().optional(),
  publicationSource: z.enum(['OUTBOX', 'DIRECT']).optional(),
  processInstanceId: z.string().optional(),
  requestHash: z.string().min(1),
  clientType: z.enum(['EMPLOYEE_PORTAL', 'MANAGER_PORTAL', 'HR_ADMIN', 'MOBILE', 'BFF', 'SYSTEM', 'SYSTEM_SCHEDULER', 'INTEGRATION']),
  dataResidencyRegion: z.string().optional(),
  hrDataSensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'RESTRICTED', 'SPECIAL_CATEGORY']).optional(),
  topic: z.string().min(1).optional(),
  eventSchemaVersion: z.number().int().positive().optional(),
  envelopeVersion: z.number().int().positive().optional(),
});

/**
 * Factory that produces a Zod schema for a fully-typed event envelope.
 *
 * @param payloadSchema – Zod schema describing the domain payload
 */
export function HrEventEnvelopeSchema<T extends z.ZodTypeAny>(payloadSchema: T) {
  return z.object({
    eventId: uuidLikeSchema(),
    eventName: z.string().min(1),
    eventSchemaVersion: z.number().int().positive(),
    tenantId: uuidLikeSchema(),
    aggregateType: z.string().min(1),
    aggregateId: uuidLikeSchema(),
    payload: payloadSchema,
    metadata: EventMetadataSchema,
    privacy: HrEventPrivacySchema,
    occurredAt: z.coerce.date(),
    version: z.number().int().positive(),
  });
}
