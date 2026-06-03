import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent } from '@hcm/shared-kernel';

import {
  CompensationPlanCreated,
  CompensationPlanActivated,
  CompensationPlanSuspended,
  CompensationPlanClosed,
} from '../aggregates/compensation-plan.aggregate.js';


import {
  CompensationBandCreated,
  CompensationBandActivated,
  CompensationBandRevised,
  CompensationBandClosed,
} from '../aggregates/compensation-band.aggregate.js';


import {
  CompensationChangeSubmitted,
  CompensationChangeApproved,
  CompensationChangeEffective,
  CompensationChangeRejected,
  CompensationChangeCancelled,
} from '../aggregates/compensation-change.aggregate.js';


import {
  BonusCycleCreated,
  BonusCycleActivated,
  BonusCycleCalculated,
  BonusCycleReviewed,
  BonusCycleApproved,
  BonusCyclePaid,
} from '../aggregates/bonus-cycle.aggregate.js';


import {
  EquityGrantIssued,
  EquityGrantVestingStarted,
  EquityGrantVested,
  EquityGrantExercised,
  EquityGrantExpired,
  EquityGrantForfeited,
} from '../aggregates/equity-grant.aggregate.js';


import {
  VariableCompPlanCreated,
  VariableCompPlanActivated,
  VariableCompPlanClosed,
} from '../aggregates/variable-comp-plan.aggregate.js';


import {
  PayScaleCreated,
  PayScaleActivated,
  PayScaleRevised,
  PayScaleClosed,
} from '../aggregates/pay-scale.aggregate.js';


import {
  TotalCompStatementGenerated,
  TotalCompStatementDelivered,
  TotalCompStatementAcknowledged,
} from '../aggregates/total-compensation-statement.aggregate.js';

type CompensationEventAggregate = {
  id: Uuid;
  tenantId: Uuid;
  status: string;
  workerId?: Uuid;
  domainEvents: DomainEvent[];
};

/**
 * Publishes canonical HrEventEnvelope events derived from
 * Compensation domain events.
 */
@Injectable()
export class CompensationEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishAll(aggregate: CompensationEventAggregate, command: HrCommandEnvelope<unknown>): Promise<void> {
    const envelopes = aggregate.domainEvents.map((event) => this.map(event, command, aggregate));
    if (envelopes.length > 0) {
      await this.eventBus.publishAll(envelopes);
    }
  }

  private map(event: DomainEvent, command: HrCommandEnvelope<unknown>, aggregate: CompensationEventAggregate): HrEventEnvelope<unknown> {
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
      privacy: createPrivacyForEvent(workerId ? 'HIGH' : 'NONE', workerId, 'COMPENSATION'),
      occurredAt: new Date(),
      version: 1,
    };

    switch (true) {
      case event instanceof CompensationPlanCreated:
        return { ...base, payload: { planId: event.aggregateId.value, name: event.name, planType: event.planType } };
      case event instanceof CompensationPlanActivated:
        return { ...base, payload: { planId: event.aggregateId.value } };
      case event instanceof CompensationPlanSuspended:
        return { ...base, payload: { planId: event.aggregateId.value } };
      case event instanceof CompensationPlanClosed:
        return { ...base, payload: { planId: event.aggregateId.value } };

      case event instanceof CompensationBandCreated:
        return { ...base, payload: { bandId: event.aggregateId.value, bandCode: event.bandCode, jobLevel: event.jobLevel, jobFamily: event.jobFamily } };
      case event instanceof CompensationBandActivated:
        return { ...base, payload: { bandId: event.aggregateId.value } };
      case event instanceof CompensationBandRevised:
        return { ...base, payload: { bandId: event.aggregateId.value, minSalary: event.minSalary, midSalary: event.midSalary, maxSalary: event.maxSalary } };
      case event instanceof CompensationBandClosed:
        return { ...base, payload: { bandId: event.aggregateId.value } };

      case event instanceof CompensationChangeSubmitted:
        return { ...base, payload: { changeId: event.aggregateId.value, workerId: event.workerId, changeType: event.changeType, newAmount: event.newAmount } };
      case event instanceof CompensationChangeApproved:
        return { ...base, payload: { changeId: event.aggregateId.value, workerId, approvedBy: event.approvedBy } };
      case event instanceof CompensationChangeEffective:
        return { ...base, payload: { changeId: event.aggregateId.value, workerId } };
      case event instanceof CompensationChangeRejected:
        return { ...base, payload: { changeId: event.aggregateId.value, workerId } };
      case event instanceof CompensationChangeCancelled:
        return { ...base, payload: { changeId: event.aggregateId.value, workerId } };

      case event instanceof BonusCycleCreated:
        return { ...base, payload: { cycleId: event.aggregateId.value, cycleName: event.cycleName, cycleYear: event.cycleYear } };
      case event instanceof BonusCycleActivated:
        return { ...base, payload: { cycleId: event.aggregateId.value } };
      case event instanceof BonusCycleCalculated:
        return { ...base, payload: { cycleId: event.aggregateId.value } };
      case event instanceof BonusCycleReviewed:
        return { ...base, payload: { cycleId: event.aggregateId.value } };
      case event instanceof BonusCycleApproved:
        return { ...base, payload: { cycleId: event.aggregateId.value } };
      case event instanceof BonusCyclePaid:
        return { ...base, payload: { cycleId: event.aggregateId.value } };

      case event instanceof EquityGrantIssued:
        return { ...base, payload: { grantId: event.aggregateId.value, workerId: event.workerId, grantType: event.grantType, totalUnits: event.totalUnits } };
      case event instanceof EquityGrantVestingStarted:
        return { ...base, payload: { grantId: event.aggregateId.value } };
      case event instanceof EquityGrantVested:
        return { ...base, payload: { grantId: event.aggregateId.value, vestedUnits: event.vestedUnits } };
      case event instanceof EquityGrantExercised:
        return { ...base, payload: { grantId: event.aggregateId.value, exercisedUnits: event.exercisedUnits } };
      case event instanceof EquityGrantExpired:
        return { ...base, payload: { grantId: event.aggregateId.value } };
      case event instanceof EquityGrantForfeited:
        return { ...base, payload: { grantId: event.aggregateId.value } };

      case event instanceof VariableCompPlanCreated:
        return { ...base, payload: { planId: event.aggregateId.value, name: event.name, planType: event.planType } };
      case event instanceof VariableCompPlanActivated:
        return { ...base, payload: { planId: event.aggregateId.value } };
      case event instanceof VariableCompPlanClosed:
        return { ...base, payload: { planId: event.aggregateId.value } };

      case event instanceof PayScaleCreated:
        return { ...base, payload: { scaleId: event.aggregateId.value, scaleCode: event.scaleCode, grade: event.grade } };
      case event instanceof PayScaleActivated:
        return { ...base, payload: { scaleId: event.aggregateId.value } };
      case event instanceof PayScaleRevised:
        return { ...base, payload: { scaleId: event.aggregateId.value, steps: event.steps } };
      case event instanceof PayScaleClosed:
        return { ...base, payload: { scaleId: event.aggregateId.value } };

      case event instanceof TotalCompStatementGenerated:
        return { ...base, payload: { statementId: event.aggregateId.value, workerId: event.workerId, statementYear: event.statementYear } };
      case event instanceof TotalCompStatementDelivered:
        return { ...base, payload: { statementId: event.aggregateId.value } };
      case event instanceof TotalCompStatementAcknowledged:
        return { ...base, payload: { statementId: event.aggregateId.value } };

      default:
        throw new Error(`Unknown compensation event type: ${event.eventName}`);
    }
  }

  private workerIdFor(event: DomainEvent, aggregate: CompensationEventAggregate): string | undefined {
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
