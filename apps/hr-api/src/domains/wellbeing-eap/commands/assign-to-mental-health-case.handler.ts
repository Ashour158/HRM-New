import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { MentalHealthCaseRepository } from '../repositories/mental-health-case.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('AssignToMentalHealthCase')
@Injectable()
export class AssignToMentalHealthCaseHandler {
  constructor(
    private readonly repo: MentalHealthCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { mentalHealthCaseId: Uuid; providerId: Uuid };
    const ar = await this.repo.findById(payload.mentalHealthCaseId);
    if (!ar) throw new Error('Mental health case not found');
    ar.assignTo(payload.providerId, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { mentalHealthCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MentalHealthCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
