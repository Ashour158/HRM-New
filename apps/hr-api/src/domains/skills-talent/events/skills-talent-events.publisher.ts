import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  SkillProfileCreated, SkillProfileUpdated, SkillProfileValidated, SkillProfileArchived,
  TalentPoolCreated, TalentPoolUpdated, TalentPoolMemberAdded, TalentPoolMemberRemoved, TalentPoolClosed,
  CareerPathCreated, CareerPathActivated, CareerPathMilestoneAchieved, CareerPathArchived,
  SuccessionPlanCreated, SuccessionPlanActivated, SuccessionPlanReviewed, SuccessionPlanExecuted, SuccessionPlanClosed,
} from '../aggregates/index.js';

@Injectable()
export class SkillsTalentEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: {
    id: Uuid;
    tenantId: Uuid;
    status: string;
    domainEvents: DomainEvent[];
  }): Promise<void> {
    const events = aggregate.domainEvents
      .map((e) => this.toEnvelope(e, aggregate.id, aggregate.tenantId))
      .filter((e): e is HrEventEnvelope<unknown> => !!e);
    await Promise.all(events.map((e) => this.eventBus.publish(e)));
  }

  private toEnvelope(event: DomainEvent, aggregateId: Uuid, tenantId: Uuid): HrEventEnvelope<unknown> | undefined {
    const base = {
      eventId: event.eventId,
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: event.aggregateType ?? 'SkillsTalent',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(event, aggregateId),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof SkillProfileCreated:
        return { ...base, payload: { skillProfileId: aggregateId.value } };
      case event instanceof SkillProfileUpdated:
        return { ...base, payload: { skillProfileId: aggregateId.value } };
      case event instanceof SkillProfileValidated:
        return { ...base, payload: { skillProfileId: aggregateId.value } };
      case event instanceof SkillProfileArchived:
        return { ...base, payload: { skillProfileId: aggregateId.value } };
      case event instanceof TalentPoolCreated:
        return { ...base, payload: { talentPoolId: aggregateId.value } };
      case event instanceof TalentPoolUpdated:
        return { ...base, payload: { talentPoolId: aggregateId.value } };
      case event instanceof TalentPoolMemberAdded:
        return { ...base, payload: { talentPoolId: aggregateId.value } };
      case event instanceof TalentPoolMemberRemoved:
        return { ...base, payload: { talentPoolId: aggregateId.value } };
      case event instanceof TalentPoolClosed:
        return { ...base, payload: { talentPoolId: aggregateId.value } };
      case event instanceof CareerPathCreated:
        return { ...base, payload: { careerPathId: aggregateId.value } };
      case event instanceof CareerPathActivated:
        return { ...base, payload: { careerPathId: aggregateId.value } };
      case event instanceof CareerPathMilestoneAchieved:
        return { ...base, payload: { careerPathId: aggregateId.value } };
      case event instanceof CareerPathArchived:
        return { ...base, payload: { careerPathId: aggregateId.value } };
      case event instanceof SuccessionPlanCreated:
        return { ...base, payload: { successionPlanId: aggregateId.value } };
      case event instanceof SuccessionPlanActivated:
        return { ...base, payload: { successionPlanId: aggregateId.value } };
      case event instanceof SuccessionPlanReviewed:
        return { ...base, payload: { successionPlanId: aggregateId.value } };
      case event instanceof SuccessionPlanExecuted:
        return { ...base, payload: { successionPlanId: aggregateId.value } };
      case event instanceof SuccessionPlanClosed:
        return { ...base, payload: { successionPlanId: aggregateId.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(_event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    return createPrivacyForEvent('NONE', aggregateId.value, 'PROFILE');
  }
}
