import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  HrAiUseCaseRegistered, HrAiUseCaseReviewed, HrAiUseCaseApproved, HrAiUseCaseActivated, HrAiUseCaseSuspended, HrAiUseCaseRetired,
  HrAiModelRunStarted, HrAiModelRunCompleted, HrAiModelRunFailed,
  HrAiBiasTestPlanned, HrAiBiasTestStarted, HrAiBiasTestCompleted, HrAiBiasTestFailed,
  KillSwitchArmed, KillSwitchTriggered, KillSwitchInvestigating, KillSwitchResolved, KillSwitchRearmed,
} from '../aggregates/index.js';

@Injectable()
export class HrAiGovernanceEventsPublisher {
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
      aggregateType: event.aggregateType ?? 'HrAiGovernance',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(event, aggregateId),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof HrAiUseCaseRegistered:
        return { ...base, payload: { hrAiUseCaseId: aggregateId.value, useCaseName: event.useCaseName } };
      case event instanceof HrAiUseCaseReviewed:
        return { ...base, payload: { hrAiUseCaseId: aggregateId.value } };
      case event instanceof HrAiUseCaseApproved:
        return { ...base, payload: { hrAiUseCaseId: aggregateId.value } };
      case event instanceof HrAiUseCaseActivated:
        return { ...base, payload: { hrAiUseCaseId: aggregateId.value } };
      case event instanceof HrAiUseCaseSuspended:
        return { ...base, payload: { hrAiUseCaseId: aggregateId.value } };
      case event instanceof HrAiUseCaseRetired:
        return { ...base, payload: { hrAiUseCaseId: aggregateId.value } };
      case event instanceof HrAiModelRunStarted:
        return { ...base, payload: { hrAiModelRunId: aggregateId.value } };
      case event instanceof HrAiModelRunCompleted:
        return { ...base, payload: { hrAiModelRunId: aggregateId.value } };
      case event instanceof HrAiModelRunFailed:
        return { ...base, payload: { hrAiModelRunId: aggregateId.value, reason: event.reason } };
      case event instanceof HrAiBiasTestPlanned:
        return { ...base, payload: { hrAiBiasTestId: aggregateId.value } };
      case event instanceof HrAiBiasTestStarted:
        return { ...base, payload: { hrAiBiasTestId: aggregateId.value } };
      case event instanceof HrAiBiasTestCompleted:
        return { ...base, payload: { hrAiBiasTestId: aggregateId.value, passed: event.passed } };
      case event instanceof HrAiBiasTestFailed:
        return { ...base, payload: { hrAiBiasTestId: aggregateId.value, reason: event.reason } };
      case event instanceof KillSwitchArmed:
        return { ...base, payload: { hrAiKillSwitchId: aggregateId.value } };
      case event instanceof KillSwitchTriggered:
        return { ...base, payload: { hrAiKillSwitchId: aggregateId.value } };
      case event instanceof KillSwitchInvestigating:
        return { ...base, payload: { hrAiKillSwitchId: aggregateId.value } };
      case event instanceof KillSwitchResolved:
        return { ...base, payload: { hrAiKillSwitchId: aggregateId.value } };
      case event instanceof KillSwitchRearmed:
        return { ...base, payload: { hrAiKillSwitchId: aggregateId.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(_event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    return createPrivacyForEvent('HIGH', aggregateId.value, 'PROFILE');
  }
}
