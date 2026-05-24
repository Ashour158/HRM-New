import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  EmployeeRelationsCaseOpened, EmployeeRelationsCaseReviewed, EmployeeRelationsCaseInvestigation,
  EmployeeRelationsCaseDisciplinary, EmployeeRelationsCaseResolved, EmployeeRelationsCaseClosed,
  InvestigationPlanned, InvestigationStarted, InvestigationEvidenceReviewed, InvestigationCompleted,
  DisciplinaryActionDrafted, DisciplinaryActionApproved, DisciplinaryActionExecuted,
  DisciplinaryActionAppealed, DisciplinaryActionUpheld, DisciplinaryActionRevoked,
  AccommodationRequested, AccommodationUnderReview, AccommodationApproved,
  AccommodationImplemented, AccommodationClosed, AccommodationRejected,
} from '../aggregates/index.js';

@Injectable()
export class EmployeeRelationsEventsPublisher {
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
      aggregateType: event.aggregateType ?? 'EmployeeRelations',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(event, aggregateId),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof EmployeeRelationsCaseOpened:
        return { ...base, payload: { employeeRelationsCaseId: aggregateId.value } };
      case event instanceof EmployeeRelationsCaseReviewed:
        return { ...base, payload: { employeeRelationsCaseId: aggregateId.value } };
      case event instanceof EmployeeRelationsCaseInvestigation:
        return { ...base, payload: { employeeRelationsCaseId: aggregateId.value } };
      case event instanceof EmployeeRelationsCaseDisciplinary:
        return { ...base, payload: { employeeRelationsCaseId: aggregateId.value } };
      case event instanceof EmployeeRelationsCaseResolved:
        return { ...base, payload: { employeeRelationsCaseId: aggregateId.value } };
      case event instanceof EmployeeRelationsCaseClosed:
        return { ...base, payload: { employeeRelationsCaseId: aggregateId.value } };
      case event instanceof InvestigationPlanned:
        return { ...base, payload: { erInvestigationId: aggregateId.value } };
      case event instanceof InvestigationStarted:
        return { ...base, payload: { erInvestigationId: aggregateId.value } };
      case event instanceof InvestigationEvidenceReviewed:
        return { ...base, payload: { erInvestigationId: aggregateId.value } };
      case event instanceof InvestigationCompleted:
        return { ...base, payload: { erInvestigationId: aggregateId.value } };
      case event instanceof DisciplinaryActionDrafted:
        return { ...base, payload: { disciplinaryActionId: aggregateId.value } };
      case event instanceof DisciplinaryActionApproved:
        return { ...base, payload: { disciplinaryActionId: aggregateId.value, approvedBy: event.approvedBy } };
      case event instanceof DisciplinaryActionExecuted:
        return { ...base, payload: { disciplinaryActionId: aggregateId.value } };
      case event instanceof DisciplinaryActionAppealed:
        return { ...base, payload: { disciplinaryActionId: aggregateId.value } };
      case event instanceof DisciplinaryActionUpheld:
        return { ...base, payload: { disciplinaryActionId: aggregateId.value } };
      case event instanceof DisciplinaryActionRevoked:
        return { ...base, payload: { disciplinaryActionId: aggregateId.value } };
      case event instanceof AccommodationRequested:
        return { ...base, payload: { accommodationCaseId: aggregateId.value } };
      case event instanceof AccommodationUnderReview:
        return { ...base, payload: { accommodationCaseId: aggregateId.value } };
      case event instanceof AccommodationApproved:
        return { ...base, payload: { accommodationCaseId: aggregateId.value } };
      case event instanceof AccommodationImplemented:
        return { ...base, payload: { accommodationCaseId: aggregateId.value } };
      case event instanceof AccommodationClosed:
        return { ...base, payload: { accommodationCaseId: aggregateId.value } };
      case event instanceof AccommodationRejected:
        return { ...base, payload: { accommodationCaseId: aggregateId.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(_event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    return createPrivacyForEvent('HIGH', aggregateId.value, 'PROFILE');
  }
}
