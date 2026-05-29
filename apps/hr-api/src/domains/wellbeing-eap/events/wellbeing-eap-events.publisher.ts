import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { EapReferral } from '../aggregates/eap-referral.aggregate.js';
import { WellnessProgram } from '../aggregates/wellness-program.aggregate.js';
import { MentalHealthCase } from '../aggregates/mental-health-case.aggregate.js';

@Injectable()
export class WellbeingEapEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: EapReferral | WellnessProgram | MentalHealthCase): Promise<void> {
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

  private buildPrivacy(aggregate: EapReferral | WellnessProgram | MentalHealthCase) {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
