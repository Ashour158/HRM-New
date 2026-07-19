import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { VariableCompPlanRepository } from '../repositories/variable-comp-plan.repository.js';
import { VariableCompPlanFsm } from '../fsm/variable-comp-plan.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for activating a VariableCompPlan.
 * DRAFT → ACTIVE.
 */
@Injectable()
@CommandHandler('ActivateVariableCompPlan')
export class ActivateVariableCompPlanHandler implements ICommandHandler {
  commandName = 'ActivateVariableCompPlan' as const;

  constructor(
    private readonly repo: VariableCompPlanRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: VariableCompPlanFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { planId: Uuid };
    const plan = await this.repo.findById(payload.planId);
    if (!plan) throw new Error('VariableCompPlan not found');

    plan.activate(command.correlationId);
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
