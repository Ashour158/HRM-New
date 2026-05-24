import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WellnessProgramRepository } from '../repositories/wellness-program.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('ArchiveWellnessProgram')
@Injectable()
export class ArchiveWellnessProgramHandler {
  constructor(
    private readonly repo: WellnessProgramRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { wellnessProgramId: Uuid };
    const ar = await this.repo.findById(payload.wellnessProgramId);
    if (!ar) throw new Error('Wellness program not found');
    ar.archive(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { wellnessProgramId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'WellnessProgram'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
