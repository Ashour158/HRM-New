import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrAiBiasTestRepository } from '../repositories/hr-ai-bias-test.repository.js';
import { HrAiGovernanceEventsPublisher } from '../events/hr-ai-governance-events.publisher.js';
import type { BiasTestGroupOutcome } from '../bias-metrics.js';

export interface CompleteHrAiBiasTestPayload {
  hrAiBiasTestId: string;
  /**
   * Raw per-protected-class-group outcome counts (selected vs. totalConsidered).
   * This is the only test input the caller controls — `passed`/`metrics` are no
   * longer accepted from the caller; the domain computes both from this data
   * (see bias-metrics.ts).
   */
  outcomeData: BiasTestGroupOutcome[];
}

@Injectable()
@CommandHandler('CompleteHrAiBiasTest')
export class CompleteHrAiBiasTestHandler {
  constructor(
    private readonly repo: HrAiBiasTestRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrAiGovernanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CompleteHrAiBiasTestPayload;
    const entity = await this.repo.findById(new Uuid(payload.hrAiBiasTestId), command.tenantId);
    if (!entity) throw new Error('HrAiBiasTest not found');
    entity.complete(command.correlationId, payload.outcomeData);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { hrAiBiasTestId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'HrAiBiasTest'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
