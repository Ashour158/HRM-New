import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OnboardingTask } from '../aggregates/onboarding-task.aggregate.js';
import { OnboardingTaskRepository } from '../repositories/onboarding-task.repository.js';
import { OnboardingEventsPublisher } from '../events/onboarding-events.publisher.js';

export interface CreateOnboardingTaskCommandPayload {
  taskId: Uuid;
  planId: Uuid;
  title: string;
  description?: string;
  assignedTo?: Uuid;
  dueDate?: Date;
}

/**
 * Handler for the CreateOnboardingTask command.
 *
 * Creates a new OnboardingTask in PENDING state.
 */
@Injectable()
@CommandHandler('CreateOnboardingTask')
export class CreateOnboardingTaskHandler implements ICommandHandler {
  readonly commandName = 'CreateOnboardingTask';

  constructor(
    private readonly taskRepo: OnboardingTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: OnboardingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateOnboardingTaskCommandPayload;

    const task = OnboardingTask.create(
      {
        id: payload.taskId,
        tenantId: command.tenantId,
        onboardingPlanId: payload.planId,
        title: payload.title,
        description: payload.description,
        assignedTo: payload.assignedTo,
        dueDate: payload.dueDate,
      },
      command.correlationId,
    );

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
      eventsEmitted: ['OnboardingTaskCreated'],
      auditRecordId: Uuid.generate(),
    };
  }
}
