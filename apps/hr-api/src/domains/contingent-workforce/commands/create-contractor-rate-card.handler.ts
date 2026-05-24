import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ContractorRateCard } from '../aggregates/contractor-rate-card.aggregate.js';
import { ContractorRateCardRepository } from '../repositories/contractor-rate-card.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('CreateContractorRateCard')
@Injectable()
export class CreateContractorRateCardHandler {
  constructor(
    private readonly repo: ContractorRateCardRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { vendorId: Uuid; jobTitle: string; rate: number; currency: string; effectiveFrom: Date; effectiveUntil?: Date };
    const ar = ContractorRateCard.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { contractorRateCardId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ContractorRateCard'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
