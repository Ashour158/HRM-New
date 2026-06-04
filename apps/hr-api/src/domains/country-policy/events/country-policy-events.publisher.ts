import { Injectable, Logger } from '@nestjs/common';
import type { Uuid, AggregateRoot, DomainEvent } from '@hcm/shared-kernel';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { getTopicForAggregate } from '@hcm/event-schemas';
import { OutboxPublisher } from '../../../platform/outbox-inbox/outbox-publisher.js';

/**
 * Domain-specific event publisher for Country Policy aggregates.
 */
@Injectable()
export class CountryPolicyEventsPublisher {
  private readonly logger = new Logger(CountryPolicyEventsPublisher.name);

  constructor(private readonly outboxPublisher: OutboxPublisher) {}

  /**
   * Publish all uncommitted domain events from the given aggregate.
   */
  async publishUncommitted(aggregate: AggregateRoot, tenantId: Uuid, correlationId: Uuid): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    for (const event of events) {
      const envelope = this.toEnvelope(event, tenantId, correlationId);
      await this.outboxPublisher.schedule(envelope, tenantId, correlationId);
      this.logger.log({
        type: 'COUNTRY_POLICY_EVENT_SCHEDULED',
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
