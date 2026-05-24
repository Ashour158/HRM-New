import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { TerminateWorkerPayload } from '@hcm/command-contracts';
import { NotFoundError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { JobAssignmentRepository } from '../repositories/job-assignment.repository.js';
import { EmploymentRelationshipRepository } from '../repositories/employment-relationship.repository.js';
import { WorkerEventsPublisher } from '../events/worker-events.publisher.js';

/**
 * Handler for the TerminateWorker command.
 * Triggers the WorkerTermination cascade.
 */
@CommandHandler('TerminateWorker')
@Injectable()
export class TerminateWorkerHandler {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly jobAssignmentRepo: JobAssignmentRepository,
    private readonly employmentRelationshipRepo: EmploymentRelationshipRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: WorkerEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as TerminateWorkerPayload;

    const worker = await this.workerRepo.findById(payload.workerId);
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    worker.terminate(payload.terminationDate, payload.reason, command.correlationId);
    await this.workerRepo.save(worker);

    const assignments = await this.jobAssignmentRepo.findByWorker(worker.id);
    for (const assignment of assignments) {
      if (assignment.state === 'ACTIVE') {
        assignment.end(payload.terminationDate, command.correlationId);
        await this.jobAssignmentRepo.save(assignment);
      }
    }

    const relationships = await this.employmentRelationshipRepo.findByWorker(worker.id);
    for (const relationship of relationships) {
      if (relationship.state !== 'ENDED') {
        relationship.end(payload.terminationDate, command.correlationId);
        await this.employmentRelationshipRepo.save(relationship);
      }
    }

    await this.eventPublisher.publishFromAggregate(worker);

    return {
      success: true,
      data: { workerId: worker.id.value, status: worker.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: worker.id,
      newState: worker.status,
      newVersion: worker.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(worker.status, 'WorkerProfile'),
      fieldAccessDecisions: {},
      eventsEmitted: worker.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
