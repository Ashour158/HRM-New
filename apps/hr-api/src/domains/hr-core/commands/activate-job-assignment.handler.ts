import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { ActivateJobAssignmentPayload } from '@hcm/command-contracts';
import { NotFoundError, Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { JobAssignmentRepository } from '../repositories/job-assignment.repository.js';

@CommandHandler('ActivateJobAssignment')
@Injectable()
export class ActivateJobAssignmentHandler {
  constructor(
    private readonly jobAssignmentRepo: JobAssignmentRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ActivateJobAssignmentPayload;
    const assignmentId = payload.assignmentId instanceof Uuid
      ? payload.assignmentId
      : new Uuid(payload.assignmentId as string);

    const assignment = await this.jobAssignmentRepo.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Job assignment not found');
    }

    assignment.activate(command.correlationId);
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
      eventsEmitted: assignment.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
