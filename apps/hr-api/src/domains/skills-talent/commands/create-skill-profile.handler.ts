import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { SkillProfile } from '../aggregates/skill-profile.aggregate.js';
import { SkillProfileRepository } from '../repositories/skill-profile.repository.js';
import { SkillsTalentEventsPublisher } from '../events/skills-talent-events.publisher.js';

@CommandHandler('CreateSkillProfile')
@Injectable()
export class CreateSkillProfileHandler {
  constructor(
    private readonly repo: SkillProfileRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: SkillsTalentEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      skills?: { skillId: string; proficiency: number }[];
    };
    const ar = SkillProfile.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        skills: payload.skills,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { skillProfileId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'SkillProfile'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
