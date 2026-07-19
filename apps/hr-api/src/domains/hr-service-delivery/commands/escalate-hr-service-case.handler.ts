import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCaseRepository } from '../repositories/hr-service-case.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('EscalateHrServiceCase')
@Injectable()
export class EscalateHrServiceCaseHandler {
  constructor(
    private readonly repo: HrServiceCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrServiceCaseId: Uuid; escalationReason: string };
    const ar = await this.repo.findById(payload.hrServiceCaseId);
    if (!ar) throw new Error('HR service case not found');
    ar.escalate(payload.escalationReason, command.actor.actorId, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: {
        hrServiceCaseId: ar.id.value,
        status: ar.status,
        escalationReason: ar.escalationReason,
        escalatedAt: ar.escalatedAt?.toISOString(),
        escalatedBy: ar.escalatedBy?.value,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
