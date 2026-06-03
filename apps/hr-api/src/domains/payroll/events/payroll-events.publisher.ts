import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  PayrollCycleOpened, PayrollCycleClosed, PayrollCycleApproved, PayrollCycleCancelled,
  PayrollInputSubmitted, PayrollInputApproved, PayrollInputRejected, PayrollInputCorrected,
  PayrollCalculationStarted, PayrollCalculationValidated, PayrollCalculationFinalized, PayrollCalculationFailed,
  PayrollResultLineCalculated, PayrollResultLineExplained, PayrollResultLineReviewed, PayrollResultLineLocked,
} from '../aggregates/index.js';

type PayrollEventAggregate = {
  id: Uuid;
  tenantId: Uuid;
  status: string;
  workerId?: Uuid;
  payrollCycleId?: Uuid;
  inputType?: string;
  amount?: number;
  currency?: string;
  domainEvents: DomainEvent[];
};

@Injectable()
export class PayrollEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: PayrollEventAggregate): Promise<void> {
    const events = aggregate.domainEvents
      .map((e) => this.toEnvelope(e, aggregate))
      .filter((e): e is HrEventEnvelope<unknown> => !!e);
    await Promise.all(events.map((e) => this.eventBus.publish(e)));
  }

  private toEnvelope(event: DomainEvent, aggregate: PayrollEventAggregate): HrEventEnvelope<unknown> | undefined {
    const aggregateId = aggregate.id;
    const base = {
      eventId: event.eventId,
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId: aggregate.tenantId,
      aggregateType: event.aggregateType ?? 'Payroll',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(aggregate),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof PayrollCycleOpened:
        return { ...base, payload: { payrollCycleId: aggregateId.value } };
      case event instanceof PayrollCycleClosed:
        return { ...base, payload: { payrollCycleId: aggregateId.value } };
      case event instanceof PayrollCycleApproved:
        return { ...base, payload: { payrollCycleId: aggregateId.value, approvedBy: event.approvedBy } };
      case event instanceof PayrollCycleCancelled:
        return { ...base, payload: { payrollCycleId: aggregateId.value } };
      case event instanceof PayrollInputSubmitted:
        return { ...base, payload: this.payrollInputPayload(aggregateId, aggregate) };
      case event instanceof PayrollInputApproved:
        return { ...base, payload: this.payrollInputPayload(aggregateId, aggregate) };
      case event instanceof PayrollInputRejected:
        return { ...base, payload: this.payrollInputPayload(aggregateId, aggregate) };
      case event instanceof PayrollInputCorrected:
        return { ...base, payload: this.payrollInputPayload(aggregateId, aggregate) };
      case event instanceof PayrollCalculationStarted:
        return { ...base, payload: { payrollCalculationRunId: aggregateId.value } };
      case event instanceof PayrollCalculationValidated:
        return { ...base, payload: { payrollCalculationRunId: aggregateId.value } };
      case event instanceof PayrollCalculationFinalized:
        return { ...base, payload: { payrollCalculationRunId: aggregateId.value } };
      case event instanceof PayrollCalculationFailed:
        return { ...base, payload: { payrollCalculationRunId: aggregateId.value } };
      case event instanceof PayrollResultLineCalculated:
        return { ...base, payload: { payrollResultLineId: aggregateId.value } };
      case event instanceof PayrollResultLineExplained:
        return { ...base, payload: { payrollResultLineId: aggregateId.value } };
      case event instanceof PayrollResultLineReviewed:
        return { ...base, payload: { payrollResultLineId: aggregateId.value } };
      case event instanceof PayrollResultLineLocked:
        return { ...base, payload: { payrollResultLineId: aggregateId.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(aggregate: PayrollEventAggregate): HrEventPrivacy {
    return createPrivacyForEvent('HIGH', aggregate.workerId?.value, 'PAYROLL');
  }

  private payrollInputPayload(aggregateId: Uuid, aggregate: PayrollEventAggregate): Record<string, unknown> {
    return {
      payrollInputId: aggregateId.value,
      workerId: aggregate.workerId?.value,
      payrollCycleId: aggregate.payrollCycleId?.value,
      inputType: aggregate.inputType,
      amount: aggregate.amount,
      currency: aggregate.currency,
    };
  }
}
