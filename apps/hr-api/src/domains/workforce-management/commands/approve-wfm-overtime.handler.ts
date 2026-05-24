import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WfmOvertimeApprovalRepository } from '../repositories/overtime-approval.repository.js';
import { WorkforceManagementEventsPublisher } from '../events/workforce-management-events.publisher.js';

@CommandHandler('ApproveWfmOvertime')
@Injectable()
export class ApproveWfmOvertimeHandler {
  constructor(
    private readonly repo: WfmOvertimeApprovalRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WorkforceManagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { overtimeApprovalId: Uuid; approvedBy: Uuid };
    const ar = await this.repo.findById(payload.overtimeApprovalId);
    if (!ar) throw new Error('Overtime approval not found');
    ar.approve(payload.approvedBy, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { overtimeApprovalId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'WfmOvertimeApproval'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
