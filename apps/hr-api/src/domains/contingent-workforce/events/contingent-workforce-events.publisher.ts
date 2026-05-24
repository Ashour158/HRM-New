import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { ContingentWorkerAssignment } from '../aggregates/contingent-worker-assignment.aggregate.js';
import { SowEngagement } from '../aggregates/sow-engagement.aggregate.js';
import { ContractorRateCard } from '../aggregates/contractor-rate-card.aggregate.js';
import { MisclassificationAssessment } from '../aggregates/misclassification-assessment.aggregate.js';

@Injectable()
export class ContingentWorkforceEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: ContingentWorkerAssignment | SowEngagement | ContractorRateCard | MisclassificationAssessment): Promise<void> {
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
      await this.eventBus.publish(envelope as any);
    }
  }

  private buildPrivacy(aggregate: ContingentWorkerAssignment | SowEngagement | ContractorRateCard | MisclassificationAssessment) {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
