/**
 * Event factory helpers for constructing and validating canonical HR events.
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Uuid, Ok, Err, type Result, type ValidationError } from '@hcm/shared-kernel';
import { ValidationError as ValidationErrorClass } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import type { HrEventPrivacy } from '../core/event-privacy.js';

/** Convenience re-export of the metadata shape. */
export type { EventMetadata } from '../core/event-envelope.js';

/**
 * Build a new {@link HrEventEnvelope} with auto-generated identifiers and timestamp.
 *
 * @param eventName          – canonical name (`{Aggregate}{PastTense}`)
 * @param aggregateType      – aggregate root type (e.g. `worker`)
 * @param aggregateId        – aggregate UUID
 * @param payload            – domain payload (UUID refs only, no raw PII)
 * @param metadata           – causation, correlation, client context
 * @param privacy            – privacy classification block
 * @param tenantId           – tenant / organisation UUID
 * @param eventSchemaVersion – schema major version (default 1)
 * @param version            – event sequence version (default 1)
 */
export function createEvent<TPayload>(
  eventName: string,
  aggregateType: string,
  aggregateId: Uuid,
  payload: TPayload,
  metadata: import('../core/event-envelope.js').EventMetadata,
  privacy: HrEventPrivacy,
  tenantId: Uuid,
  eventSchemaVersion = 1,
  version = 1,
): HrEventEnvelope<TPayload> {
  return {
    eventId: new Uuid(randomUUID()),
    eventName,
    eventSchemaVersion,
    tenantId,
    aggregateType,
    aggregateId,
    payload,
    metadata,
    privacy,
    occurredAt: new Date(),
    version,
  };
}

/**
 * Validate an untrusted value against a concrete event envelope schema.
 *
 * @param schema        – Zod schema returned by {@link HrEventEnvelopeSchema}
 * @param unknownValue  – raw JSON / object to validate
 */
export function validateEvent<TPayload>(
  schema: z.ZodType<HrEventEnvelope<TPayload>>,
  unknownValue: unknown,
): Result<HrEventEnvelope<TPayload>, ValidationError> {
  const result = schema.safeParse(unknownValue);
  if (result.success) {
    return new Ok(result.data);
  }

  const details: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }

  return new Err(new ValidationErrorClass('Event validation failed', details));
}
