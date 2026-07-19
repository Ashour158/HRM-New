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
import { WorksCouncilConsultationGuard } from '../../global-hr/services/works-council-consultation-guard.service.js';

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
    private readonly worksCouncilGuard: WorksCouncilConsultationGuard,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as TerminateWorkerPayload;

    const worker = await this.workerRepo.findByIdForTenant(payload.workerId, command.tenantId);
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    // Compliance gate: termination cannot proceed while the worker's legal
    // entity has a required works-council consultation that has not
    // completed. Workers with no legal entity on file are not scoped by this
    // guard (see WorksCouncilConsultationGuard for the scoping rationale) —
    // we only ever block against the legal entity we can cleanly resolve.
    if (worker.legalEntityId) {
      await this.worksCouncilGuard.assertNotBlocked(worker.legalEntityId, command.tenantId, 'terminate worker');
    }

    worker.terminate(payload.terminationDate, payload.reason, command.correlationId);
    await this.workerRepo.save(worker);

    const eventsEmitted = worker.domainEvents.map((e) => e.eventName);

    const assignments = await this.jobAssignmentRepo.findByWorkerForTenant(worker.id, command.tenantId);
    for (const assignment of assignments) {
      if (assignment.state === 'ACTIVE') {
        assignment.end(payload.terminationDate, command.correlationId);
        await this.jobAssignmentRepo.save(assignment);
        eventsEmitted.push(...assignment.domainEvents.map((e) => e.eventName));
      }
    }

    const relationships = await this.employmentRelationshipRepo.findByWorkerForTenant(worker.id, command.tenantId);
    for (const relationship of relationships) {
      if (relationship.state !== 'ENDED') {
        relationship.end(payload.terminationDate, command.correlationId);
        await this.employmentRelationshipRepo.save(relationship);
        eventsEmitted.push(...relationship.domainEvents.map((e) => e.eventName));
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
      eventsEmitted,
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
