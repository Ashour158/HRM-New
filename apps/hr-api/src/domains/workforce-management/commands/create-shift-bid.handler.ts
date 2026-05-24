import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ShiftBid } from '../aggregates/shift-bid.aggregate.js';
import { ShiftBidRepository } from '../repositories/shift-bid.repository.js';
import { WorkforceManagementEventsPublisher } from '../events/workforce-management-events.publisher.js';

@CommandHandler('CreateShiftBid')
@Injectable()
export class CreateShiftBidHandler {
  constructor(
    private readonly repo: ShiftBidRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WorkforceManagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workerId: Uuid; openShiftId: Uuid };
    const ar = ShiftBid.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        openShiftId: payload.openShiftId,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { shiftBidId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ShiftBid'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
