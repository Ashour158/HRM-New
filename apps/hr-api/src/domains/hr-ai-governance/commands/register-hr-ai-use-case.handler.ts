import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrAiUseCase } from '../aggregates/hr-ai-use-case.aggregate.js';
import { HrAiUseCaseRepository } from '../repositories/hr-ai-use-case.repository.js';
import { HrAiGovernanceEventsPublisher } from '../events/hr-ai-governance-events.publisher.js';

export interface RegisterHrAiUseCasePayload {
  hrAiUseCaseId: string;
  useCaseName: string;
  useCaseType: string;
  riskClassification: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNACCEPTABLE';
  description?: string;
  dataUsage?: Record<string, unknown>;
}

@Injectable()
@CommandHandler('RegisterHrAiUseCase')
export class RegisterHrAiUseCaseHandler {
  constructor(
    private readonly repo: HrAiUseCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrAiGovernanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RegisterHrAiUseCasePayload;
    const entity = HrAiUseCase.create({
      id: new Uuid(payload.hrAiUseCaseId),
      tenantId: command.tenantId,
      useCaseName: payload.useCaseName,
      useCaseType: payload.useCaseType,
      riskClassification: payload.riskClassification,
      description: payload.description,
      dataUsage: payload.dataUsage,
    }, command.correlationId);
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
