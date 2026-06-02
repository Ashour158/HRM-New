import { Injectable, NotFoundException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OnboardingEventsPublisher } from '../events/onboarding-events.publisher.js';
import { OnboardingTaskRepository } from '../repositories/onboarding-task.repository.js';
import { toUuid, type UuidInput } from '../../common/uuid-normalizer.js';

export interface RecordOnboardingTaskEvidenceCommandPayload {
  taskId: UuidInput;
  evidenceType?: string;
  evidencePayload?: Record<string, unknown>;
  signingProviderEnvelopeId?: string;
  provisioningTarget?: string;
  completionNotes?: string;
  completeTask?: boolean;
}

@Injectable()
@CommandHandler('RecordOnboardingTaskEvidence')
export class RecordOnboardingTaskEvidenceHandler implements ICommandHandler {
  readonly commandName = 'RecordOnboardingTaskEvidence';

  constructor(
    private readonly taskRepo: OnboardingTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: OnboardingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RecordOnboardingTaskEvidenceCommandPayload;
    const task = await this.taskRepo.findById(toUuid(payload.taskId));
    if (!task) {
      throw new NotFoundException('Onboarding task not found');
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
      allowedNextActions: this.fsm.getAllowedActionsFromState(task.status, 'OnboardingTask'),
      fieldAccessDecisions: {},
      eventsEmitted: payload.completeTask ? ['OnboardingTaskEvidenceRecorded', 'OnboardingTaskCompleted'] : ['OnboardingTaskEvidenceRecorded'],
      auditRecordId: Uuid.generate(),
    };
  }
}
