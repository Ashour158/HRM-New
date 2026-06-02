import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OnboardingTask } from '../aggregates/onboarding-task.aggregate.js';
import type { OnboardingTaskCategory, OnboardingTaskOwnerGroup } from '../aggregates/onboarding-task.aggregate.js';
import { OnboardingTaskRepository } from '../repositories/onboarding-task.repository.js';
import { OnboardingEventsPublisher } from '../events/onboarding-events.publisher.js';
import { toUuid, type UuidInput } from '../../common/uuid-normalizer.js';

export interface CreateOnboardingTaskCommandPayload {
  taskId: UuidInput;
  planId: UuidInput;
  title: string;
  description?: string;
  assignedTo?: UuidInput;
  ownerGroup?: OnboardingTaskOwnerGroup | string;
  category?: OnboardingTaskCategory;
  required?: boolean;
  evidenceType?: string;
  evidencePayload?: Record<string, unknown>;
  provisioningTarget?: string;
  signingProviderEnvelopeId?: string;
  milestoneDay?: number;
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
        id: toUuid(payload.taskId),
        tenantId: command.tenantId,
        onboardingPlanId: toUuid(payload.planId),
        title: payload.title,
        description: payload.description,
        assignedTo: payload.assignedTo ? toUuid(payload.assignedTo) : undefined,
        ownerGroup: normalizeOwnerGroup(payload.ownerGroup),
        category: payload.category,
        required: payload.required,
        evidenceType: payload.evidenceType,
        evidencePayload: payload.evidencePayload,
        provisioningTarget: payload.provisioningTarget,
        signingProviderEnvelopeId: payload.signingProviderEnvelopeId,
        milestoneDay: payload.milestoneDay,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
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

function normalizeOwnerGroup(value: OnboardingTaskOwnerGroup | string | undefined): OnboardingTaskOwnerGroup | undefined {
  if (!value) return undefined;
  const normalized = value.toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'FINANCE') return 'FINANCE';
  if (normalized === 'ADMIN') return 'ADMIN';
  if (normalized === 'MANAGER') return 'MANAGER';
  if (normalized === 'SECURITY') return 'SECURITY';
  if (normalized === 'FACILITIES') return 'FACILITIES';
  if (normalized === 'EMPLOYEE') return 'EMPLOYEE';
  if (normalized === 'BUDDY') return 'BUDDY';
  if (normalized === 'COMPLIANCE') return 'COMPLIANCE';
  if (normalized === 'IT') return 'IT';
  return 'HR';
}
