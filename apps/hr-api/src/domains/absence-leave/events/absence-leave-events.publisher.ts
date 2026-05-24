import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  AbsenceRequestSubmitted, AbsenceRequestApproved, AbsenceRequestRejected, AbsenceRequestCancelled,
  LeaveCaseOpened, LeaveCaseApproved, LeaveCaseActive, ReturnToWorkPlanned, LeaveCaseClosed, LeaveCaseRejected,
  AccrualBalanceCreated, AccrualBalanceUpdated, AccrualBalanceCarriedOver, AccrualBalanceClosed,
  LeaveEntitlementCalculationStarted, LeaveEntitlementCalculated, LeaveEntitlementCalculationFailed,
} from '../aggregates/index.js';

@Injectable()
export class AbsenceLeaveEventsPublisher {
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
      aggregateType: event.aggregateType ?? 'AbsenceLeave',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(event, aggregateId),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof AbsenceRequestSubmitted:
        return { ...base, payload: { absenceRequestId: aggregateId.value } };
      case event instanceof AbsenceRequestApproved:
        return { ...base, payload: { absenceRequestId: aggregateId.value, approvedBy: event.approvedBy } };
      case event instanceof AbsenceRequestRejected:
        return { ...base, payload: { absenceRequestId: aggregateId.value } };
      case event instanceof AbsenceRequestCancelled:
        return { ...base, payload: { absenceRequestId: aggregateId.value } };
      case event instanceof LeaveCaseOpened:
        return { ...base, payload: { leaveCaseId: aggregateId.value } };
      case event instanceof LeaveCaseApproved:
        return { ...base, payload: { leaveCaseId: aggregateId.value } };
      case event instanceof LeaveCaseActive:
        return { ...base, payload: { leaveCaseId: aggregateId.value } };
      case event instanceof ReturnToWorkPlanned:
        return { ...base, payload: { leaveCaseId: aggregateId.value } };
      case event instanceof LeaveCaseClosed:
        return { ...base, payload: { leaveCaseId: aggregateId.value } };
      case event instanceof LeaveCaseRejected:
        return { ...base, payload: { leaveCaseId: aggregateId.value } };
      case event instanceof AccrualBalanceCreated:
        return { ...base, payload: { absenceAccrualBalanceId: aggregateId.value } };
      case event instanceof AccrualBalanceUpdated:
        return { ...base, payload: { absenceAccrualBalanceId: aggregateId.value } };
      case event instanceof AccrualBalanceCarriedOver:
        return { ...base, payload: { absenceAccrualBalanceId: aggregateId.value } };
      case event instanceof AccrualBalanceClosed:
        return { ...base, payload: { absenceAccrualBalanceId: aggregateId.value } };
      case event instanceof LeaveEntitlementCalculationStarted:
        return { ...base, payload: { leaveEntitlementCalculationId: aggregateId.value } };
      case event instanceof LeaveEntitlementCalculated:
        return { ...base, payload: { leaveEntitlementCalculationId: aggregateId.value } };
      case event instanceof LeaveEntitlementCalculationFailed:
        return { ...base, payload: { leaveEntitlementCalculationId: aggregateId.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(_event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    return createPrivacyForEvent('NONE', aggregateId.value, 'PROFILE');
  }
}
