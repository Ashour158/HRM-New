import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CreateJobAssignmentPayload } from '@hcm/command-contracts';
import { NotFoundError, ValidationError, Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { JobAssignmentRepository } from '../repositories/job-assignment.repository.js';
import { JobAssignment } from '../aggregates/job-assignment.aggregate.js';

/**
 * Handler for the CreateJobAssignment command.
 */
@CommandHandler('CreateJobAssignment')
@Injectable()
export class CreateJobAssignmentHandler {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly jobAssignmentRepo: JobAssignmentRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateJobAssignmentPayload;

    const workerId = payload.workerId instanceof Uuid ? payload.workerId : new Uuid(payload.workerId as string);
    const worker = await this.workerRepo.findById(workerId);
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }
    if (worker.status !== 'ACTIVE') {
      throw new ValidationError('Worker must be ACTIVE to create a job assignment');
    }

    const assignment = JobAssignment.create(
      {
        id: payload.assignmentId instanceof Uuid ? payload.assignmentId : new Uuid(payload.assignmentId as string),
        tenantId: command.tenantId,
        workerId,
        positionId: payload.positionId instanceof Uuid ? payload.positionId : new Uuid(payload.positionId as string),
        startDate: payload.startDate,
        endDate: payload.endDate,
        assignmentType: 'PRIMARY',
        state: 'DRAFT',
      },
      command.correlationId,
    );

    await this.jobAssignmentRepo.save(assignment);

    return {
      success: true,
      data: { assignmentId: assignment.id.value },
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
