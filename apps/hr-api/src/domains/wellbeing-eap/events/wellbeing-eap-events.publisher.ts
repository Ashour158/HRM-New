import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { EapReferral } from '../aggregates/eap-referral.aggregate.js';
import { WellnessProgram } from '../aggregates/wellness-program.aggregate.js';
import { MentalHealthCase } from '../aggregates/mental-health-case.aggregate.js';

@Injectable()
export class WellbeingEapEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: EapReferral | WellnessProgram | MentalHealthCase): Promise<void> {
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

  private buildPrivacy(aggregate: EapReferral | WellnessProgram | MentalHealthCase): HrEventPrivacy {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
