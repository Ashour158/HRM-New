import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CompensationPlanRepository } from '../repositories/compensation-plan.repository.js';
import { CompensationPlan } from '../aggregates/compensation-plan.aggregate.js';
import { CompensationPlanFsm } from '../fsm/compensation-plan.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for creating a new CompensationPlan.
 */
@Injectable()
@CommandHandler('CreateCompensationPlan')
export class CreateCompensationPlanHandler implements ICommandHandler {
  commandName = 'CreateCompensationPlan' as const;

  constructor(
    private readonly repo: CompensationPlanRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: CompensationPlanFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      planId: Uuid;
      name: string;
      planType: string;
      currency: string;
      effectiveFrom?: Date;
      effectiveUntil?: Date;
    };

    const plan = CompensationPlan.create({
      id: payload.planId,
      tenantId: command.tenantId,
      name: payload.name,
      planType: payload.planType,
      currency: payload.currency,
      effectiveFrom: payload.effectiveFrom,
      effectiveUntil: payload.effectiveUntil,
      correlationId: command.correlationId,
    });

    await this.repo.save(plan);
    const eventsEmitted = plan.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(plan, command);

    return {
      success: true,
      data: { planId: plan.id.value, status: plan.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: plan.id,
      newState: plan.status,
      newVersion: plan.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(plan.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
