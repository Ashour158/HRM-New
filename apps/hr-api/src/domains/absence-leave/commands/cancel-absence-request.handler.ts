import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { AbsenceRequestRepository } from '../repositories/absence-request.repository.js';
import { AbsenceLeaveEventsPublisher } from '../events/absence-leave-events.publisher.js';

@CommandHandler('CancelAbsenceRequest')
@Injectable()
export class CancelAbsenceRequestHandler {
  constructor(
    private readonly repo: AbsenceRequestRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: AbsenceLeaveEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { absenceRequestId: Uuid };
    const ar = await this.repo.findById(payload.absenceRequestId);
    if (!ar) throw new Error('Absence request not found');
    ar.cancel(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { absenceRequestId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'AbsenceRequest'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
