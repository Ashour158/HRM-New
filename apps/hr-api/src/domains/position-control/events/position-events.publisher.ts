import { Injectable, Logger } from '@nestjs/common';
import type { Uuid, AggregateRoot, DomainEvent } from '@hcm/shared-kernel';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { getTopicForAggregate } from '@hcm/event-schemas';
import { EventBus } from '../../../platform/event-bus/event-bus.js';

/**
 * Domain-specific event publisher for Position and HeadcountRequest aggregates.
 *
 * Reads uncommitted domain events from an aggregate, maps them to canonical
 * {@link HrEventEnvelope} instances, and publishes them to the appropriate
 * topic (hr.core.v1 for position aggregates).
 */
@Injectable()
export class PositionEventsPublisher {
  private readonly logger = new Logger(PositionEventsPublisher.name);

  constructor(private readonly eventBus: EventBus) {}

  /**
   * Publish all uncommitted domain events from the given aggregate.
   */
  async publishUncommitted(aggregate: AggregateRoot, tenantId: Uuid, correlationId: Uuid): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    for (const event of events) {
      const envelope = this.toEnvelope(event, tenantId, correlationId);
      await this.eventBus.publish(envelope);
      this.logger.log({
        type: 'POSITION_EVENT_PUBLISHED',
        eventName: envelope.eventName,
        aggregateId: envelope.aggregateId.value,
        topic: getTopicForAggregate(envelope.aggregateType),
      });
    }
    aggregate.clearDomainEvents();
  }

  private toEnvelope(event: DomainEvent, tenantId: Uuid, correlationId: Uuid): HrEventEnvelope<unknown> {
    return {
      eventId: event.eventId,
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: {},
      metadata: {
        correlationId,
        causationId: event.causationId,
        requestHash: '',
        clientType: 'SYSTEM',
      },
      privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
      occurredAt: event.occurredAt,
      version: event.version,
    };
  }
}
