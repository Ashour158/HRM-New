import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrAiBiasTest } from '../aggregates/hr-ai-bias-test.aggregate.js';
import { HrAiBiasTestRepository } from '../repositories/hr-ai-bias-test.repository.js';
import { HrAiGovernanceEventsPublisher } from '../events/hr-ai-governance-events.publisher.js';

export interface PlanHrAiBiasTestPayload {
  hrAiBiasTestId: string;
  useCaseId: string;
  testType: string;
  testData?: Record<string, unknown>;
  threshold?: number;
}

@Injectable()
@CommandHandler('PlanHrAiBiasTest')
export class PlanHrAiBiasTestHandler {
  constructor(
    private readonly repo: HrAiBiasTestRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrAiGovernanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as PlanHrAiBiasTestPayload;
    const entity = HrAiBiasTest.create({
      id: new Uuid(payload.hrAiBiasTestId),
      tenantId: command.tenantId,
      useCaseId: new Uuid(payload.useCaseId),
      testType: payload.testType,
      testData: payload.testData,
      threshold: payload.threshold,
    }, command.correlationId);
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
