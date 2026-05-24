import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrAiKillSwitch } from '../aggregates/hr-ai-kill-switch.aggregate.js';
import { HrAiKillSwitchRepository } from '../repositories/hr-ai-kill-switch.repository.js';
import { HrAiGovernanceEventsPublisher } from '../events/hr-ai-governance-events.publisher.js';

export interface ArmHrAiKillSwitchPayload {
  hrAiKillSwitchId: string;
  useCaseId: string;
  triggeredBy: string;
  triggerReason: string;
}

@Injectable()
@CommandHandler('ArmHrAiKillSwitch')
export class ArmHrAiKillSwitchHandler {
  constructor(
    private readonly repo: HrAiKillSwitchRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrAiGovernanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ArmHrAiKillSwitchPayload;
    const entity = HrAiKillSwitch.create({
      id: new Uuid(payload.hrAiKillSwitchId),
      tenantId: command.tenantId,
      useCaseId: new Uuid(payload.useCaseId),
      triggeredBy: new Uuid(payload.triggeredBy),
      triggerReason: payload.triggerReason,
    }, command.correlationId);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { hrAiKillSwitchId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'HrAiKillSwitch'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
