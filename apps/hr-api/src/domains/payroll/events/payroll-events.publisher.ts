import { Injectable, Logger } from '@nestjs/common';
import type { Uuid, AggregateRoot, DomainEvent } from '@hcm/shared-kernel';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { getTopicForAggregate } from '@hcm/event-schemas';
import { OutboxPublisher } from '../../../platform/outbox-inbox/outbox-publisher.js';

/**
 * Domain-specific event publisher for payroll aggregates
 * (PayrollCycle, PayrollInput, PayrollCalculationRun).
 *
 * Mirrors {@link PositionEventsPublisher}: reads uncommitted domain events
 * from an aggregate, maps them to canonical {@link HrEventEnvelope}
 * instances, and schedules them on the transactional outbox (hr.payroll.v1).
 *
 * This publisher is intended for saga call sites that mutate aggregates and
 * call `repo.save()` directly, bypassing the CommandBus. Command handlers
 * invoked through the CommandBus must NOT call this publisher: the bus
 * already writes `CommandResult.eventsEmitted` to the outbox transactionally
 * in `stepWriteOutbox`, so publishing here too would double-publish (and,
 * since `OutboxPublisher` runs on a separate system connection outside the
 * command's transaction, it could publish an event for a command whose
 * transaction later rolled back).
 */
@Injectable()
export class PayrollEventsPublisher {
  private readonly logger = new Logger(PayrollEventsPublisher.name);

  constructor(private readonly outboxPublisher: OutboxPublisher) {}

  /**
   * Publish all uncommitted domain events from the given aggregate.
   */
  async publishUncommitted(aggregate: AggregateRoot, tenantId: Uuid, correlationId: Uuid): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    for (const event of events) {
      const envelope = this.toEnvelope(event, tenantId, correlationId);
      await this.outboxPublisher.schedule(envelope, tenantId, correlationId);
      this.logger.log({
        type: 'PAYROLL_EVENT_SCHEDULED',
        eventName: envelope.eventName,
        aggregateId: envelope.aggregateId.value,
        topic: getTopicForAggregate(envelope.aggregateType),
      });
    }
    aggregate.clearDomainEvents();
  }

  private toEnvelope(event: DomainEvent, tenantId: Uuid, correlationId: Uuid): HrEventEnvelope<unknown> {
    return {
      eventId: event.eventId,
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: this.toPayload(event, correlationId),
      metadata: {
        correlationId,
        causationId: event.causationId,
        requestHash: '',
        clientType: 'SYSTEM',
      },
      privacy: createPrivacyForEvent('NONE', undefined, 'PAYROLL'),
      occurredAt: event.occurredAt,
      version: event.version,
    };
  }

  private toPayload(event: DomainEvent, actorId: Uuid): Record<string, unknown> {
    switch (event.eventName) {
      case 'PayrollCycleOpened':
      case 'PayrollCycleClosed':
      case 'PayrollCycleInputCollectionStarted':
      case 'PayrollCycleValidationStarted':
      case 'PayrollCycleCalculationStarted':
      case 'PayrollCycleReviewStarted':
      case 'PayrollCycleCancelled':
        return {
          payrollCycleId: event.aggregateId,
          actorId,
        };
      case 'PayrollCycleApproved':
        return {
          payrollCycleId: event.aggregateId,
          approvedBy: actorId,
        };
      case 'PayrollInputCreated':
      case 'PayrollInputSubmitted':
      case 'PayrollInputApproved':
      case 'PayrollInputRejected':
      case 'PayrollInputCorrected':
        return {
          payrollInputId: event.aggregateId,
          actorId,
        };
      case 'PayrollCalculationStarted':
      case 'PayrollCalculationValidated':
      case 'PayrollCalculationFinalized':
      case 'PayrollCalculationFailed':
        return {
          calculationRunId: event.aggregateId,
          actorId,
        };
      default:
        return {
          aggregateId: event.aggregateId,
          actorId,
        };
    }
  }
}
