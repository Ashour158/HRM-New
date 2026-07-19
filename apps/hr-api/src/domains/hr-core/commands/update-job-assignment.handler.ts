import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandResult, HrCommandEnvelope, UpdateJobAssignmentPayload } from '@hcm/command-contracts';
import { NotFoundError, Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { JobAssignmentRepository } from '../repositories/job-assignment.repository.js';

function toUuid(value: Uuid | string | undefined): Uuid | undefined {
  if (value === undefined) return undefined;
  return value instanceof Uuid ? value : new Uuid(value);
}

@CommandHandler('UpdateJobAssignment')
@Injectable()
export class UpdateJobAssignmentHandler {
  constructor(
    private readonly jobAssignmentRepo: JobAssignmentRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as UpdateJobAssignmentPayload;
    const assignmentId = payload.assignmentId instanceof Uuid
      ? payload.assignmentId
      : new Uuid(payload.assignmentId as string);

    const assignment = await this.jobAssignmentRepo.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Job assignment not found');
    }

    assignment.update(
      {
        jobTitle: payload.jobTitle,
        departmentId: toUuid(payload.departmentId),
        managerId: toUuid(payload.managerId),
        positionId: toUuid(payload.positionId),
      },
      command.correlationId,
    );
    const eventsEmitted = assignment.domainEvents.map((e) => e.eventName);
    await this.jobAssignmentRepo.save(assignment);

    return {
      success: true,
      data: { assignmentId: assignment.id.value, status: assignment.state },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: assignment.id,
      newState: assignment.state,
      newVersion: assignment.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(assignment.state, 'JobAssignment'),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
