import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { ActivateWorkerPayload } from '@hcm/command-contracts';
import { NotFoundError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { FieldPolicyEngine, type AbacContext } from '@hcm/access-control';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { WorkerEventsPublisher } from '../events/worker-events.publisher.js';
import { buildFieldAccessDecisions } from './create-worker.handler.js';

/**
 * Handler for the ActivateWorker command.
 */
@CommandHandler('ActivateWorker')
@Injectable()
export class ActivateWorkerHandler {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: WorkerEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ActivateWorkerPayload;

    const worker = await this.workerRepo.findById(payload.workerId);
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    worker.activate(command.correlationId);
    await this.workerRepo.save(worker);

    await this.eventPublisher.publishFromAggregate(worker);

    const abacContext: AbacContext = {
      subjectWorkerId: command.subjectWorkerId,
      actorWorkerId: command.actor.actorId,
      isSelf: command.subjectWorkerId?.value === command.actor.actorId.value,
      isManager: false,
      isManagerChain: false,
      isPeer: false,
      legalEntityIds: [],
      countryCodes: [],
      departmentIds: [],
      timeOfAccess: new Date(),
      breakGlassActive: false,
      mfaAuthenticated: command.actor.mfaAuthenticated,
    };

    return {
      success: true,
      data: { workerId: worker.id.value, status: worker.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: worker.id,
      newState: worker.status,
      newVersion: worker.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(worker.status, 'WorkerProfile'),
      fieldAccessDecisions: buildFieldAccessDecisions(new FieldPolicyEngine(), command.actor.roles, abacContext),
      eventsEmitted: worker.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
