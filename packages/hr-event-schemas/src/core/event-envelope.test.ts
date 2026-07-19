import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Uuid } from '@hcm/shared-kernel';
import { HrEventEnvelopeSchema } from './event-envelope.js';
import { createPrivacyForEvent } from './event-privacy.js';

/**
 * Every `HrEventEnvelope`/`EventMetadata` UUID field (`eventId`, `tenantId`,
 * `aggregateId`, `metadata.correlationId`, `metadata.causationId`,
 * `metadata.sourceEventId`) is typed `Uuid` in TypeScript, but at runtime
 * shows up as one of three different shapes depending on how the envelope
 * reached the validator:
 *
 *  - a real `Uuid` instance (in-process construction via `createEvent()` /
 *    `outboxRowToEnvelope()`, or `InMemoryEventBus` handing the same object
 *    to subscribers)
 *  - a raw UUID string (already-unwrapped `.value`)
 *  - a plain `{ value: string }` object (what a `Uuid` becomes after
 *    `KafkaEventBus` round-trips it through `JSON.stringify`/`JSON.parse`,
 *    since `Uuid` has no `toJSON`)
 *
 * This locks in that `HrEventEnvelopeSchema` (and therefore every `isXEvent`
 * guard built from it) accepts all three, since a schema that only accepted
 * raw strings would reject every event a real event bus ever delivers.
 */
describe('HrEventEnvelopeSchema UUID field normalization', () => {
  const uuid = '11111111-1111-1111-1111-111111111111';
  const schema = HrEventEnvelopeSchema(z.object({}));

  function baseEnvelope(idShape: (id: string) => unknown) {
    return {
      eventId: idShape(uuid),
      eventName: 'SomethingHappened',
      eventSchemaVersion: 1,
      tenantId: idShape(uuid),
      aggregateType: 'Widget',
      aggregateId: idShape(uuid),
      payload: {},
      metadata: {
        correlationId: idShape(uuid),
        causationId: idShape(uuid),
        sourceEventId: idShape(uuid),
        requestHash: 'hash',
        clientType: 'SYSTEM',
      },
      privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
      occurredAt: new Date(),
      version: 1,
    };
  }

  it('accepts real Uuid instances (in-process / InMemoryEventBus shape)', () => {
    const envelope = baseEnvelope((id) => new Uuid(id));
    expect(schema.safeParse(envelope).success).toBe(true);
  });

  it('accepts raw UUID strings (already-unwrapped .value)', () => {
    const envelope = baseEnvelope((id) => id);
    expect(schema.safeParse(envelope).success).toBe(true);
  });

  it('accepts { value: string } objects (post JSON.stringify/parse via KafkaEventBus)', () => {
    const envelope = baseEnvelope((id) => JSON.parse(JSON.stringify(new Uuid(id))));
    expect(schema.safeParse(envelope).success).toBe(true);
  });

  it('still rejects a genuinely invalid id', () => {
    const envelope = baseEnvelope(() => 'not-a-uuid');
    expect(schema.safeParse(envelope).success).toBe(false);
  });
});
