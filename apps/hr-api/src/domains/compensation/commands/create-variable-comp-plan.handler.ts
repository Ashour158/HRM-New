import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { VariableCompPlanRepository } from '../repositories/variable-comp-plan.repository.js';
import { VariableCompPlan } from '../aggregates/variable-comp-plan.aggregate.js';
import { VariableCompPlanFsm } from '../fsm/variable-comp-plan.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for creating a new VariableCompPlan.
 */
@Injectable()
@CommandHandler('CreateVariableCompPlan')
export class CreateVariableCompPlanHandler implements ICommandHandler {
  commandName = 'CreateVariableCompPlan' as const;

  constructor(
    private readonly repo: VariableCompPlanRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: VariableCompPlanFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      planId: Uuid;
      name: string;
      planType: string;
      targetPercentage: number;
      maxPercentage: number;
      currency: string;
    };

    const plan = VariableCompPlan.create({
      id: payload.planId,
      tenantId: command.tenantId,
      name: payload.name,
      planType: payload.planType,
      targetPercentage: payload.targetPercentage,
      maxPercentage: payload.maxPercentage,
      currency: payload.currency,
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
