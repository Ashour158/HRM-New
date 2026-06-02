import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { UnionRecognition } from '../aggregates/union-recognition.aggregate.js';
import { Grievance } from '../aggregates/grievance.aggregate.js';
import { CollectiveBargainingSession } from '../aggregates/collective-bargaining-session.aggregate.js';

@Injectable()
export class UnionLaborEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: UnionRecognition | Grievance | CollectiveBargainingSession): Promise<void> {
    for (const event of aggregate.domainEvents) {
      const envelope: HrEventEnvelope<Record<string, never>> = {
        eventId: event.eventId,
        eventName: event.eventName,
        eventSchemaVersion: 1,
        tenantId: event.tenantId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: {},
        metadata: {
          correlationId: event.correlationId,
          causationId: event.causationId,
          requestHash: event.eventId.value,
          clientType: 'HR_ADMIN',
        },
        privacy: this.buildPrivacy(aggregate),
        occurredAt: event.occurredAt,
        version: event.version,
      };
      await this.eventBus.publish(envelope);
    }
  }

  private buildPrivacy(aggregate: UnionRecognition | Grievance | CollectiveBargainingSession): HrEventPrivacy {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
