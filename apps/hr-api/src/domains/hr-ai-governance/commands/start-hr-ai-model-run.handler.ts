import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrAiModelRunRepository } from '../repositories/hr-ai-model-run.repository.js';
import { HrAiUseCaseGuard } from '../services/hr-ai-use-case-guard.service.js';
import { HrAiGovernanceEventsPublisher } from '../events/hr-ai-governance-events.publisher.js';

export interface StartHrAiModelRunPayload {
  hrAiModelRunId: string;
}

@Injectable()
@CommandHandler('StartHrAiModelRun')
export class StartHrAiModelRunHandler {
  constructor(
    private readonly repo: HrAiModelRunRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrAiGovernanceEventsPublisher,
    private readonly useCaseGuard: HrAiUseCaseGuard,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as StartHrAiModelRunPayload;
    const entity = await this.repo.findById(new Uuid(payload.hrAiModelRunId), command.tenantId);
    if (!entity) throw new Error('HrAiModelRun not found');

    // Safety-stop enforcement: re-checked at start time (not just at create
    // time) so a use case suspended or kill switch triggered after this run
    // was created still blocks it from actually starting.
    await this.useCaseGuard.assertRunnable(entity.useCaseId, command.tenantId, 'start HR AI model run');

    entity.start(command.correlationId);
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
