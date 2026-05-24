import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { TalentPool } from '../aggregates/talent-pool.aggregate.js';
import { TalentPoolRepository } from '../repositories/talent-pool.repository.js';
import { SkillsTalentEventsPublisher } from '../events/skills-talent-events.publisher.js';

@CommandHandler('CreateTalentPool')
@Injectable()
export class CreateTalentPoolHandler {
  constructor(
    private readonly repo: TalentPoolRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: SkillsTalentEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      poolName: string;
      criteria?: Record<string, unknown>;
      memberIds?: string[];
    };
    const ar = TalentPool.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        poolName: payload.poolName,
        criteria: payload.criteria,
        memberIds: payload.memberIds,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { talentPoolId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'TalentPool'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
