import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { ActivateEmploymentContractPayload, CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { NotFoundError, Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { EmploymentContractRepository } from '../repositories/employment-contract.repository.js';

function toUuid(value: Uuid | string): Uuid {
  return value instanceof Uuid ? value : new Uuid(value);
}

@CommandHandler('ActivateEmploymentContract')
@Injectable()
export class ActivateEmploymentContractHandler {
  constructor(
    private readonly employmentContractRepo: EmploymentContractRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ActivateEmploymentContractPayload;
    const contract = await this.employmentContractRepo.findById(toUuid(payload.contractId));
    if (!contract) throw new NotFoundError('Contract not found');

    contract.activate(command.correlationId);
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
