import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  HrServiceCaseOpened, HrServiceCaseInProgress, HrServiceCasePendingCustomer, HrServiceCaseResolved, HrServiceCaseClosed,
  HrCaseTaskCreated, HrCaseTaskStarted, HrCaseTaskCompleted, HrCaseTaskOverdue, HrCaseTaskCancelled,
  HrKnowledgeArticleCreated, HrKnowledgeArticlePublished, HrKnowledgeArticleArchived,
  HrServiceCatalogItemCreated, HrServiceCatalogItemActivated, HrServiceCatalogItemSuspended, HrServiceCatalogItemRetired,
  SlaInstanceActivated, SlaInstanceBreached, SlaInstanceMet, SlaInstanceExempted,
} from '../aggregates/index.js';

@Injectable()
export class HrServiceDeliveryEventsPublisher {
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
      aggregateType: event.aggregateType ?? 'HrServiceDelivery',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(event, aggregateId),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof HrServiceCaseOpened:
        return { ...base, payload: { hrServiceCaseId: aggregateId.value } };
      case event instanceof HrServiceCaseInProgress:
        return { ...base, payload: { hrServiceCaseId: aggregateId.value } };
      case event instanceof HrServiceCasePendingCustomer:
        return { ...base, payload: { hrServiceCaseId: aggregateId.value } };
      case event instanceof HrServiceCaseResolved:
        return { ...base, payload: { hrServiceCaseId: aggregateId.value } };
      case event instanceof HrServiceCaseClosed:
        return { ...base, payload: { hrServiceCaseId: aggregateId.value } };
      case event instanceof HrCaseTaskCreated:
        return { ...base, payload: { hrCaseTaskId: aggregateId.value } };
      case event instanceof HrCaseTaskStarted:
        return { ...base, payload: { hrCaseTaskId: aggregateId.value } };
      case event instanceof HrCaseTaskCompleted:
        return { ...base, payload: { hrCaseTaskId: aggregateId.value } };
      case event instanceof HrCaseTaskOverdue:
        return { ...base, payload: { hrCaseTaskId: aggregateId.value } };
      case event instanceof HrCaseTaskCancelled:
        return { ...base, payload: { hrCaseTaskId: aggregateId.value } };
      case event instanceof HrKnowledgeArticleCreated:
        return { ...base, payload: { hrKnowledgeArticleId: aggregateId.value } };
      case event instanceof HrKnowledgeArticlePublished:
        return { ...base, payload: { hrKnowledgeArticleId: aggregateId.value } };
      case event instanceof HrKnowledgeArticleArchived:
        return { ...base, payload: { hrKnowledgeArticleId: aggregateId.value } };
      case event instanceof HrServiceCatalogItemCreated:
        return { ...base, payload: { hrServiceCatalogItemId: aggregateId.value } };
      case event instanceof HrServiceCatalogItemActivated:
        return { ...base, payload: { hrServiceCatalogItemId: aggregateId.value } };
      case event instanceof HrServiceCatalogItemSuspended:
        return { ...base, payload: { hrServiceCatalogItemId: aggregateId.value } };
      case event instanceof HrServiceCatalogItemRetired:
        return { ...base, payload: { hrServiceCatalogItemId: aggregateId.value } };
      case event instanceof SlaInstanceActivated:
        return { ...base, payload: { hrCaseSlaInstanceId: aggregateId.value } };
      case event instanceof SlaInstanceBreached:
        return { ...base, payload: { hrCaseSlaInstanceId: aggregateId.value } };
      case event instanceof SlaInstanceMet:
        return { ...base, payload: { hrCaseSlaInstanceId: aggregateId.value } };
      case event instanceof SlaInstanceExempted:
        return { ...base, payload: { hrCaseSlaInstanceId: aggregateId.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(_event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    return createPrivacyForEvent('NONE', aggregateId.value, 'PROFILE');
  }
}
