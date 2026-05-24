import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrAiModelRunRepository } from '../repositories/hr-ai-model-run.repository.js';
import { HrAiGovernanceEventsPublisher } from '../events/hr-ai-governance-events.publisher.js';

export interface CompleteHrAiModelRunPayload {
  hrAiModelRunId: string;
  outputDataSnapshot: Record<string, unknown>;
}

@Injectable()
@CommandHandler('CompleteHrAiModelRun')
export class CompleteHrAiModelRunHandler {
  constructor(
    private readonly repo: HrAiModelRunRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrAiGovernanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CompleteHrAiModelRunPayload;
    const entity = await this.repo.findById(new Uuid(payload.hrAiModelRunId));
    if (!entity) throw new Error('HrAiModelRun not found');
    entity.complete(command.correlationId, payload.outputDataSnapshot);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { hrAiModelRunId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'HrAiModelRun'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
