import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandResult, CreateEmploymentContractPayload, HrCommandEnvelope } from '@hcm/command-contracts';
import { NotFoundError, Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { EmploymentContractRepository } from '../repositories/employment-contract.repository.js';
import { EmploymentContract } from '../aggregates/employment-contract.aggregate.js';

function toUuid(value: Uuid | string): Uuid {
  return value instanceof Uuid ? value : new Uuid(value);
}

@CommandHandler('CreateEmploymentContract')
@Injectable()
export class CreateEmploymentContractHandler {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly employmentContractRepo: EmploymentContractRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateEmploymentContractPayload & { terms?: Record<string, unknown> };
    const workerId = toUuid(payload.workerId as Uuid | string);
    const worker = await this.workerRepo.findByIdForTenant(workerId, command.tenantId);
    if (!worker) throw new NotFoundError('Worker not found');

    const contract = EmploymentContract.create(
      {
        id: toUuid(payload.contractId as Uuid | string),
        tenantId: command.tenantId,
        workerId,
        contractType: payload.contractType,
        startDate: payload.startDate,
        endDate: payload.endDate,
        terms: payload.terms,
        state: 'DRAFT',
      },
      command.correlationId,
    );
    const eventsEmitted = contract.domainEvents.map((event) => event.eventName);
    await this.employmentContractRepo.save(contract);

    return {
      success: true,
      data: { contractId: contract.id.value, state: contract.state },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: contract.id,
      newState: contract.state,
      newVersion: contract.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(contract.state, 'EmploymentContract'),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
