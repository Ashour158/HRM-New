import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OffboardingTaskRepository } from '../repositories/offboarding-task.repository.js';
import { OffboardingEventsPublisher } from '../events/offboarding-events.publisher.js';
import { toUuid, type UuidInput } from '../../common/uuid-normalizer.js';

export interface CompleteOffboardingTaskCommandPayload {
  taskId: UuidInput;
}

/**
 * Handler for the CompleteOffboardingTask command.
 *
 * Transitions a task to COMPLETED.
 */
@Injectable()
@CommandHandler('CompleteOffboardingTask')
export class CompleteOffboardingTaskHandler implements ICommandHandler {
  readonly commandName = 'CompleteOffboardingTask';

  constructor(
    private readonly taskRepo: OffboardingTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: OffboardingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CompleteOffboardingTaskCommandPayload;
    const task = await this.taskRepo.findById(toUuid(payload.taskId));
    if (!task) {
      throw new NotFoundException('Offboarding task not found');
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
      allowedNextActions: this.fsm.getAllowedActionsFromState(task.status, 'OffboardingTask'),
      fieldAccessDecisions: {},
      eventsEmitted: ['OffboardingTaskCompleted'],
      auditRecordId: Uuid.generate(),
    };
  }
}
