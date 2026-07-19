import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { ConflictError, Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OffboardingPlanRepository } from '../repositories/offboarding-plan.repository.js';
import { OffboardingTaskRepository } from '../repositories/offboarding-task.repository.js';
import { OffboardingEventsPublisher } from '../events/offboarding-events.publisher.js';
import { toUuid, type UuidInput } from '../../common/uuid-normalizer.js';

export interface CompleteOffboardingCommandPayload {
  planId: UuidInput;
}

/**
 * Handler for the CompleteOffboarding command.
 *
 * Transitions an offboarding plan from ACTIVE to COMPLETED. Refuses to
 * complete while required exit tasks (asset return, access revocation
 * confirmation, final settlement confirmation, ...) are still open.
 */
@Injectable()
@CommandHandler('CompleteOffboarding')
export class CompleteOffboardingHandler implements ICommandHandler {
  readonly commandName = 'CompleteOffboarding';

  constructor(
    private readonly planRepo: OffboardingPlanRepository,
    private readonly taskRepo: OffboardingTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: OffboardingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CompleteOffboardingCommandPayload;
    const plan = await this.planRepo.findById(toUuid(payload.planId));
    if (!plan) {
      throw new NotFoundException('Offboarding plan not found');
    }
    const requiredTasks = (await this.taskRepo.findByPlan(plan.id)).filter((task) => task.required);
    const incompleteRequiredTasks = requiredTasks.filter((task) => task.status !== 'COMPLETED' && task.status !== 'SKIPPED');
    if (incompleteRequiredTasks.length > 0) {
      throw new ConflictError('Cannot complete offboarding while required exit tasks are open');
    }

    plan.complete(command.correlationId);
    await this.planRepo.save(plan);
    await this.eventPublisher.publishUncommitted(plan, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { planId: plan.id.value, status: plan.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: plan.id,
      newState: plan.status,
      newVersion: plan.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(plan.status, 'OffboardingPlan'),
      fieldAccessDecisions: {},
      eventsEmitted: ['OffboardingPlanCompleted'],
      auditRecordId: Uuid.generate(),
    };
  }
}
