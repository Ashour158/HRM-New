import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { NotFoundError, Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { WorkerEventsPublisher } from '../events/worker-events.publisher.js';

function toUuid(value: Uuid | string): Uuid {
  return value instanceof Uuid ? value : new Uuid(value);
}

interface ReinstateWorkerPayload {
  workerId: Uuid | string;
  effectiveDate?: Date;
}

@CommandHandler('ReinstateWorker')
@Injectable()
export class ReinstateWorkerHandler {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: WorkerEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ReinstateWorkerPayload;
    const worker = await this.workerRepo.findByIdForTenant(toUuid(payload.workerId as Uuid | string), command.tenantId);
    if (!worker) throw new NotFoundError('Worker not found');

    worker.reinstate(command.correlationId);
    const eventsEmitted = worker.domainEvents.map((event) => event.eventName);
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
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
