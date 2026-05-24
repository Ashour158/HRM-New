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

@Injectable()
export class PayrollEventsPublisher {
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
      aggregateType: event.aggregateType ?? 'Payroll',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(event, aggregateId),
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
        return { ...base, payload: { payrollInputId: aggregateId.value } };
      case event instanceof PayrollInputApproved:
        return { ...base, payload: { payrollInputId: aggregateId.value } };
      case event instanceof PayrollInputRejected:
        return { ...base, payload: { payrollInputId: aggregateId.value } };
      case event instanceof PayrollInputCorrected:
        return { ...base, payload: { payrollInputId: aggregateId.value } };
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

  private buildPrivacy(_event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    return createPrivacyForEvent('HIGH', aggregateId.value, 'PAYROLL');
  }
}
