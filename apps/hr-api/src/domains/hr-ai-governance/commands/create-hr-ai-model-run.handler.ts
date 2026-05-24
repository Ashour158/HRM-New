import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrAiModelRun } from '../aggregates/hr-ai-model-run.aggregate.js';
import { HrAiModelRunRepository } from '../repositories/hr-ai-model-run.repository.js';
import { HrAiGovernanceEventsPublisher } from '../events/hr-ai-governance-events.publisher.js';

export interface CreateHrAiModelRunPayload {
  hrAiModelRunId: string;
  useCaseId: string;
  modelVersion: string;
  inputDataSnapshot?: Record<string, unknown>;
}

@Injectable()
@CommandHandler('CreateHrAiModelRun')
export class CreateHrAiModelRunHandler {
  constructor(
    private readonly repo: HrAiModelRunRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrAiGovernanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateHrAiModelRunPayload;
    const entity = HrAiModelRun.create({
      id: new Uuid(payload.hrAiModelRunId),
      tenantId: command.tenantId,
      useCaseId: new Uuid(payload.useCaseId),
      modelVersion: payload.modelVersion,
      inputDataSnapshot: payload.inputDataSnapshot,
    }, command.correlationId);
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
