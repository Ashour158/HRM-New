import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent } from '@hcm/shared-kernel';

import {
  BenefitsProgramCreated,
  BenefitsProgramActivated,
  BenefitsProgramSuspended,
  BenefitsProgramClosed,
} from '../aggregates/benefits-program.aggregate.js';


import {
  BenefitsEnrollmentSubmitted,
  BenefitsEnrollmentApproved,
  BenefitsEnrollmentEffective,
  BenefitsEnrollmentTerminated,
  BenefitsEnrollmentRejected,
} from '../aggregates/benefits-enrollment.aggregate.js';


import {
  LifeEventRecorded,
  LifeEventProcessed,
  LifeEventRejected,
} from '../aggregates/benefits-life-event.aggregate.js';


import {
  SpendingAccountCreated,
  SpendingAccountUpdated,
  SpendingAccountClosed,
} from '../aggregates/spending-account.aggregate.js';


import {
  CarrierReconciliationStarted,
  CarrierReconciliationVarianceDetected,
  CarrierReconciliationCompleted,
  CarrierReconciliationFailed,
} from '../aggregates/carrier-reconciliation-run.aggregate.js';

type BenefitsEventAggregate = {
  id: Uuid;
  tenantId: Uuid;
  status: string;
  workerId?: Uuid;
  programId?: Uuid;
  domainEvents: DomainEvent[];
};

/**
 * Publishes canonical HrEventEnvelope events derived from
 * Benefits domain events.
 */
@Injectable()
export class BenefitsEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishAll(aggregate: BenefitsEventAggregate, command: HrCommandEnvelope<unknown>): Promise<void> {
    const envelopes = aggregate.domainEvents.map((event) => this.map(event, command, aggregate));
    if (envelopes.length > 0) {
      await this.eventBus.publishAll(envelopes);
    }
  }

  private map(event: DomainEvent, command: HrCommandEnvelope<unknown>, aggregate: BenefitsEventAggregate): HrEventEnvelope<unknown> {
    const workerId = this.workerIdFor(event, aggregate);
    const base = {
      eventId: Uuid.generate(),
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId: command.tenantId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      metadata: {
        correlationId: command.correlationId,
        causationId: command.commandId,
        requestHash: command.metadata.requestHash,
        clientType: command.metadata.clientType,
      },
      privacy: createPrivacyForEvent(workerId ? 'LOW' : 'NONE', workerId, 'BENEFITS'),
      occurredAt: new Date(),
      version: 1,
    };

    switch (true) {
      case event instanceof BenefitsProgramCreated:
        return { ...base, payload: { programId: event.aggregateId.value, programName: event.programName, programType: event.programType } };
      case event instanceof BenefitsProgramActivated:
        return { ...base, payload: { programId: event.aggregateId.value } };
      case event instanceof BenefitsProgramSuspended:
        return { ...base, payload: { programId: event.aggregateId.value } };
      case event instanceof BenefitsProgramClosed:
        return { ...base, payload: { programId: event.aggregateId.value } };

      case event instanceof BenefitsEnrollmentSubmitted:
        return { ...base, payload: { enrollmentId: event.aggregateId.value, workerId: event.workerId, programId: event.programId } };
      case event instanceof BenefitsEnrollmentApproved:
        return { ...base, payload: { enrollmentId: event.aggregateId.value, workerId, programId: aggregate.programId?.value } };
      case event instanceof BenefitsEnrollmentEffective:
        return { ...base, payload: { enrollmentId: event.aggregateId.value, workerId, programId: aggregate.programId?.value } };
      case event instanceof BenefitsEnrollmentTerminated:
        return { ...base, payload: { enrollmentId: event.aggregateId.value, workerId, programId: aggregate.programId?.value } };
      case event instanceof BenefitsEnrollmentRejected:
        return { ...base, payload: { enrollmentId: event.aggregateId.value, workerId, programId: aggregate.programId?.value } };

      case event instanceof LifeEventRecorded:
        return { ...base, payload: { lifeEventId: event.aggregateId.value, workerId: event.workerId, eventType: event.eventType } };
      case event instanceof LifeEventProcessed:
        return { ...base, payload: { lifeEventId: event.aggregateId.value } };
      case event instanceof LifeEventRejected:
        return { ...base, payload: { lifeEventId: event.aggregateId.value } };

      case event instanceof SpendingAccountCreated:
        return { ...base, payload: { accountId: event.aggregateId.value, workerId: event.workerId, accountType: event.accountType } };
      case event instanceof SpendingAccountUpdated:
        return { ...base, payload: { accountId: event.aggregateId.value, usedAmount: event.usedAmount, availableAmount: event.availableAmount } };
      case event instanceof SpendingAccountClosed:
        return { ...base, payload: { accountId: event.aggregateId.value } };

      case event instanceof CarrierReconciliationStarted:
        return { ...base, payload: { runId: event.aggregateId.value, carrierId: event.carrierId } };
      case event instanceof CarrierReconciliationVarianceDetected:
        return { ...base, payload: { runId: event.aggregateId.value, varianceAmount: event.varianceAmount } };
      case event instanceof CarrierReconciliationCompleted:
        return { ...base, payload: { runId: event.aggregateId.value } };
      case event instanceof CarrierReconciliationFailed:
        return { ...base, payload: { runId: event.aggregateId.value } };

      default:
        throw new Error(`Unknown benefits event type: ${event.eventName}`);
    }
  }

  private workerIdFor(event: DomainEvent, aggregate: BenefitsEventAggregate): string | undefined {
    const eventWorkerId = this.readUuidValue((event as { workerId?: unknown }).workerId);
    return eventWorkerId ?? aggregate.workerId?.value;
  }

  private readUuidValue(value: unknown): string | undefined {
    if (value instanceof Uuid) return value.value;
    if (typeof value === 'string' && Uuid.isValid(value)) return value;
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const raw = (value as { value?: unknown }).value;
      return typeof raw === 'string' && Uuid.isValid(raw) ? raw : undefined;
    }
    return undefined;
  }
}
