import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrAiUseCaseRepository } from '../repositories/hr-ai-use-case.repository.js';
import { HrAiGovernanceEventsPublisher } from '../events/hr-ai-governance-events.publisher.js';

export interface RetireHrAiUseCasePayload {
  hrAiUseCaseId: string;
}

@Injectable()
@CommandHandler('RetireHrAiUseCase')
export class RetireHrAiUseCaseHandler {
  constructor(
    private readonly repo: HrAiUseCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrAiGovernanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RetireHrAiUseCasePayload;
    const entity = await this.repo.findById(new Uuid(payload.hrAiUseCaseId), command.tenantId);
    if (!entity) throw new Error('HrAiUseCase not found');
    entity.retire(command.correlationId);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { hrAiUseCaseId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'HrAiUseCase'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
