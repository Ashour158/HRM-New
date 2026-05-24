import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { ActivateWorkerPayload } from '@hcm/command-contracts';
import { NotFoundError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { WorkerEventsPublisher } from '../events/worker-events.publisher.js';

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
