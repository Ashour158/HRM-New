import { Injectable, NotFoundException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OffboardingEventsPublisher } from '../events/offboarding-events.publisher.js';
import { OffboardingTaskRepository } from '../repositories/offboarding-task.repository.js';
import { toUuid, type UuidInput } from '../../common/uuid-normalizer.js';

export interface RecordOffboardingTaskEvidenceCommandPayload {
  taskId: UuidInput;
  evidenceType?: string;
  evidencePayload?: Record<string, unknown>;
  completionNotes?: string;
  completeTask?: boolean;
}

@Injectable()
@CommandHandler('RecordOffboardingTaskEvidence')
export class RecordOffboardingTaskEvidenceHandler implements ICommandHandler {
  readonly commandName = 'RecordOffboardingTaskEvidence';

  constructor(
    private readonly taskRepo: OffboardingTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: OffboardingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RecordOffboardingTaskEvidenceCommandPayload;
    const task = await this.taskRepo.findById(toUuid(payload.taskId));
    if (!task) {
      throw new NotFoundException('Offboarding task not found');
    }

    task.recordEvidence(payload, command.correlationId);
    await this.taskRepo.save(task);
    await this.eventPublisher.publishUncommitted(task, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { taskId: task.id.value, status: task.status, evidenceType: task.evidenceType },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: task.id,
      newState: task.status,
      newVersion: task.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(task.status, 'OffboardingTask'),
      fieldAccessDecisions: {},
      eventsEmitted: payload.completeTask ? ['OffboardingTaskEvidenceRecorded', 'OffboardingTaskCompleted'] : ['OffboardingTaskEvidenceRecorded'],
      auditRecordId: Uuid.generate(),
    };
  }
}
