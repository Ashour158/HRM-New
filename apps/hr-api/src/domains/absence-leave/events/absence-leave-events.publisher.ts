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

type AbsenceEventAggregate = {
  id: Uuid;
  tenantId: Uuid;
  status: string;
  workerId?: Uuid;
  absenceType?: string;
  policyCode?: string;
  durationUnit?: string;
  durationAmount?: number;
  paid?: boolean;
  deductFromBalance?: boolean;
  payrollImpact?: string;
  domainEvents: DomainEvent[];
};

@Injectable()
export class AbsenceLeaveEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: AbsenceEventAggregate): Promise<void> {
    const events = aggregate.domainEvents
      .map((e) => this.toEnvelope(e, aggregate))
      .filter((e): e is HrEventEnvelope<unknown> => !!e);
    await Promise.all(events.map((e) => this.eventBus.publish(e)));
  }

  private toEnvelope(event: DomainEvent, aggregate: AbsenceEventAggregate): HrEventEnvelope<unknown> | undefined {
    const aggregateId = aggregate.id;
    const tenantId = aggregate.tenantId;
    const base = {
      eventId: event.eventId,
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: event.aggregateType ?? 'AbsenceLeave',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(aggregate),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof AbsenceRequestSubmitted:
        return { ...base, payload: this.absenceRequestPayload(aggregate) };
      case event instanceof AbsenceRequestApproved:
        return { ...base, payload: { ...this.absenceRequestPayload(aggregate), approvedBy: event.approvedBy } };
      case event instanceof AbsenceRequestRejected:
        return { ...base, payload: this.absenceRequestPayload(aggregate) };
      case event instanceof AbsenceRequestCancelled:
        return { ...base, payload: this.absenceRequestPayload(aggregate) };
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

  private buildPrivacy(aggregate: AbsenceEventAggregate): HrEventPrivacy {
    return createPrivacyForEvent('LOW', aggregate.workerId?.value, 'PROFILE');
  }

  private absenceRequestPayload(aggregate: AbsenceEventAggregate): Record<string, unknown> {
    return {
      absenceRequestId: aggregate.id.value,
      workerId: aggregate.workerId?.value,
      absenceType: aggregate.absenceType,
      policyCode: aggregate.policyCode,
      durationUnit: aggregate.durationUnit,
      durationAmount: aggregate.durationAmount,
      paid: aggregate.paid,
      deductFromBalance: aggregate.deductFromBalance,
      payrollImpact: aggregate.payrollImpact,
    };
  }
}
