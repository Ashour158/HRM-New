import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CareerPathRepository } from '../repositories/career-path.repository.js';
import { SkillsTalentEventsPublisher } from '../events/skills-talent-events.publisher.js';

@CommandHandler('ActivateCareerPath')
@Injectable()
export class ActivateCareerPathHandler {
  constructor(
    private readonly repo: CareerPathRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: SkillsTalentEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { careerPathId: Uuid };
    const ar = await this.repo.findById(payload.careerPathId);
    if (!ar) throw new Error('Career path not found');
    ar.activate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { careerPathId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'CareerPath'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
