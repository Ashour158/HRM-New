import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { UnionRecognition } from '../aggregates/union-recognition.aggregate.js';
import { Grievance } from '../aggregates/grievance.aggregate.js';
import { CollectiveBargainingSession } from '../aggregates/collective-bargaining-session.aggregate.js';

@Injectable()
export class UnionLaborEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: UnionRecognition | Grievance | CollectiveBargainingSession): Promise<void> {
    for (const event of aggregate.domainEvents) {
      const envelope = {
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId.value,
        tenantId: event.tenantId.value,
        correlationId: event.correlationId.value,
        payload: {},
        privacy: this.buildPrivacy(aggregate),
        occurredAt: new Date(),
      };
      await this.eventBus.publish(envelope as never);
    }
  }

  private buildPrivacy(aggregate: UnionRecognition | Grievance | CollectiveBargainingSession) {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
