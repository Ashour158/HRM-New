import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OvertimeApprovalRepository } from '../repositories/overtime-approval.repository.js';
import { TimeAttendanceEventsPublisher } from '../events/time-attendance-events.publisher.js';

@CommandHandler('ApproveOvertime')
@Injectable()
export class ApproveOvertimeHandler {
  constructor(
    private readonly repo: OvertimeApprovalRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: TimeAttendanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { overtimeApprovalId: Uuid; approvedBy: Uuid };
    const ot = await this.repo.findById(payload.overtimeApprovalId);
    if (!ot) throw new Error('Overtime approval not found');
    ot.approve(payload.approvedBy, command.correlationId);
    await this.repo.save(ot);
    await this.publisher.publishFromAggregate(ot);
    return {
      success: true,
      data: { overtimeApprovalId: ot.id.value, status: ot.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ot.id,
      newState: ot.status,
      newVersion: ot.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ot.status, 'OvertimeApproval'),
      eventsEmitted: ot.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
