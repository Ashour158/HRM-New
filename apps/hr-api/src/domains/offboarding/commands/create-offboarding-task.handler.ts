import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OffboardingTask } from '../aggregates/offboarding-task.aggregate.js';
import type { OffboardingTaskCategory, OffboardingTaskOwnerGroup } from '../aggregates/offboarding-task.aggregate.js';
import { OffboardingTaskRepository } from '../repositories/offboarding-task.repository.js';
import { OffboardingEventsPublisher } from '../events/offboarding-events.publisher.js';
import { toUuid, toOptionalUuid, type UuidInput } from '../../common/uuid-normalizer.js';

export interface CreateOffboardingTaskCommandPayload {
  taskId: UuidInput;
  planId: UuidInput;
  title: string;
  description?: string;
  assignedTo?: UuidInput;
  ownerGroup?: OffboardingTaskOwnerGroup | string;
  category?: OffboardingTaskCategory;
  required?: boolean;
  evidenceType?: string;
  evidencePayload?: Record<string, unknown>;
  dueDate?: Date;
}

/**
 * Handler for the CreateOffboardingTask command.
 *
 * Creates a new OffboardingTask in PENDING state.
 */
@Injectable()
@CommandHandler('CreateOffboardingTask')
export class CreateOffboardingTaskHandler implements ICommandHandler {
  readonly commandName = 'CreateOffboardingTask';

  constructor(
    private readonly taskRepo: OffboardingTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: OffboardingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateOffboardingTaskCommandPayload;

    const task = OffboardingTask.create(
      {
        id: toUuid(payload.taskId),
        tenantId: command.tenantId,
        offboardingPlanId: toUuid(payload.planId),
        title: payload.title,
        description: payload.description,
        assignedTo: toOptionalUuid(payload.assignedTo),
        ownerGroup: normalizeOwnerGroup(payload.ownerGroup),
        category: payload.category,
        required: payload.required,
        evidenceType: payload.evidenceType,
        evidencePayload: payload.evidencePayload,
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
      allowedNextActions: this.fsm.getAllowedActionsFromState(task.status, 'OffboardingTask'),
      fieldAccessDecisions: {},
      eventsEmitted: ['OffboardingTaskCreated'],
      auditRecordId: Uuid.generate(),
    };
  }
}

function normalizeOwnerGroup(value: OffboardingTaskOwnerGroup | string | undefined): OffboardingTaskOwnerGroup | undefined {
  if (!value) return undefined;
  const normalized = value.toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'FINANCE') return 'FINANCE';
  if (normalized === 'MANAGER') return 'MANAGER';
  if (normalized === 'SECURITY') return 'SECURITY';
  if (normalized === 'FACILITIES') return 'FACILITIES';
  if (normalized === 'EMPLOYEE') return 'EMPLOYEE';
  if (normalized === 'IT') return 'IT';
  return 'HR';
}
