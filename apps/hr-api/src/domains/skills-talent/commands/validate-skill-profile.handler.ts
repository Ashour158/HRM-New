import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { SkillProfileRepository } from '../repositories/skill-profile.repository.js';
import { SkillsTalentEventsPublisher } from '../events/skills-talent-events.publisher.js';

@CommandHandler('ValidateSkillProfile')
@Injectable()
export class ValidateSkillProfileHandler {
  constructor(
    private readonly repo: SkillProfileRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: SkillsTalentEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { skillProfileId: Uuid; validatedBy: Uuid };
    const ar = await this.repo.findById(payload.skillProfileId);
    if (!ar) throw new Error('Skill profile not found');
    ar.validate(payload.validatedBy, command.correlationId);
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
