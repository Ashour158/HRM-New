import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OnboardingTaskRepository } from '../repositories/onboarding-task.repository.js';
import { OnboardingEventsPublisher } from '../events/onboarding-events.publisher.js';

export interface CompleteOnboardingTaskCommandPayload {
  taskId: Uuid;
}

/**
 * Handler for the CompleteOnboardingTask command.
 *
 * Transitions a task to COMPLETED.
 */
@Injectable()
@CommandHandler('CompleteOnboardingTask')
export class CompleteOnboardingTaskHandler implements ICommandHandler {
  readonly commandName = 'CompleteOnboardingTask';

  constructor(
    private readonly taskRepo: OnboardingTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: OnboardingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CompleteOnboardingTaskCommandPayload;
    const task = await this.taskRepo.findById(payload.taskId);
    if (!task) {
      throw new NotFoundException('Onboarding task not found');
    }

    task.complete(command.correlationId);
    await this.taskRepo.save(task);
    await this.eventPublisher.publishUncommitted(task, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { taskId: task.id.value, status: task.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: task.id,
      newState: task.status,
      newVersion: task.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(task.status, 'OnboardingTask'),
      fieldAccessDecisions: {},
      eventsEmitted: ['OnboardingTaskCompleted'],
      auditRecordId: Uuid.generate(),
    };
  }
}
