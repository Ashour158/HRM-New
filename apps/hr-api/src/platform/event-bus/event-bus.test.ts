import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { HR_ABSENCE, HR_CORE } from '@hcm/event-schemas';
import { InMemoryEventBus } from './event-bus.js';

function eventFor(aggregateType: string, eventName: string): HrEventEnvelope<unknown> {
  return {
    eventId: Uuid.generate(),
    eventName,
    eventSchemaVersion: 1,
    tenantId: Uuid.generate(),
    aggregateType,
    aggregateId: Uuid.generate(),
    payload: {},
    metadata: {
      correlationId: Uuid.generate(),
    },
    privacy: {
      classification: 'INTERNAL',
      containsPii: false,
      fieldClassifications: {},
      visibilityScope: 'PLATFORM',
    },
    occurredAt: new Date(),
    version: 1,
  };
}

describe('InMemoryEventBus canonical routing', () => {
  it('publishes events to canonical blueprint topics', async () => {
    const bus = new InMemoryEventBus();
    const absenceHandler = { consumerGroup: 'absence-consumer-v1', handle: vi.fn().mockResolvedValue(undefined) };
    const coreHandler = { consumerGroup: 'core-consumer-v1', handle: vi.fn().mockResolvedValue(undefined) };
    const handled = new Promise<void>((resolve) => {
      absenceHandler.handle.mockImplementation(async () => {
        resolve();
      });
    });

    bus.subscribe(HR_ABSENCE, absenceHandler.consumerGroup, absenceHandler);
    bus.subscribe(HR_CORE, coreHandler.consumerGroup, coreHandler);

    await bus.publish(eventFor('absenceRequest', 'AbsenceRequestApproved'));
    await handled;

    expect(absenceHandler.handle).toHaveBeenCalledTimes(1);
    expect(coreHandler.handle).not.toHaveBeenCalled();
  });

  it('records direct publish diagnostics when events reach the bus without outbox evidence', async () => {
    const bus = new InMemoryEventBus();

    await bus.publish(eventFor('absenceRequest', 'AbsenceRequestApproved'));

    const diagnostics = (bus as {
      getPublicationDiagnostics?: () => {
        directPublications: Array<{ eventName: string }>;
      };
    }).getPublicationDiagnostics?.();
    expect(diagnostics?.directPublications).toEqual([
      expect.objectContaining({ eventName: 'AbsenceRequestApproved' }),
    ]);
  });

  it('suppresses duplicate event ids before handlers observe them', async () => {
    const bus = new InMemoryEventBus();
    const handler = { consumerGroup: 'absence-consumer-v1', handle: vi.fn().mockResolvedValue(undefined) };
    const event = eventFor('absenceRequest', 'AbsenceRequestApproved');

    bus.subscribe(HR_ABSENCE, handler.consumerGroup, handler);
    await bus.publish(event);
    await bus.publish(event);

    expect(handler.handle).toHaveBeenCalledTimes(1);
  });
});
