import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { LeaveCase } from '../aggregates/leave-case.aggregate.js';
import { LeaveCaseRepository } from '../repositories/leave-case.repository.js';
import { AbsenceLeaveEventsPublisher } from '../events/absence-leave-events.publisher.js';

@CommandHandler('OpenLeaveCase')
@Injectable()
export class OpenLeaveCaseHandler {
  constructor(
    private readonly repo: LeaveCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: AbsenceLeaveEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      leaveType: string;
      startDate: Date;
      expectedReturnDate?: Date;
    };
    const lc = LeaveCase.open(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        leaveType: payload.leaveType,
        startDate: payload.startDate,
        expectedReturnDate: payload.expectedReturnDate,
      },
      command.correlationId,
    );
    await this.repo.save(lc);
    await this.publisher.publishFromAggregate(lc);
    return {
      success: true,
      data: { leaveCaseId: lc.id.value, status: lc.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: lc.id,
      newState: lc.status,
      newVersion: lc.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(lc.status, 'LeaveCase'),
      eventsEmitted: lc.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
