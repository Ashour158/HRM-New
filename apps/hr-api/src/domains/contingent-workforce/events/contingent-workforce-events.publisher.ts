import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
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

  private buildPrivacy(aggregate: ContingentWorkerAssignment | SowEngagement | ContractorRateCard | MisclassificationAssessment): HrEventPrivacy {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
