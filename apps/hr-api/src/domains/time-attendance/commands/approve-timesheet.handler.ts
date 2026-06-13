import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { resolveTenantCurrency } from '../../hcm-setup/hcm-setup-currency.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { TimesheetRepository } from '../repositories/timesheet.repository.js';
import { TimeAttendanceEventsPublisher } from '../events/time-attendance-events.publisher.js';

@CommandHandler('ApproveTimesheet')
@Injectable()
export class ApproveTimesheetHandler {
  constructor(
    private readonly repo: TimesheetRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: TimeAttendanceEventsPublisher,
    private readonly hcmSetupService: HcmSetupService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { timesheetId: Uuid; approvedBy: Uuid };
    const ts = await this.repo.findById(payload.timesheetId);
    if (!ts) throw new Error('Timesheet not found');
    // Resolve setup before any mutation/publish so a setup failure cannot leave the
    // timesheet approved but the command failed (deterministic outcomes).
    const setup = await this.hcmSetupService.getSetup(ts.tenantId);
    ts.approve(payload.approvedBy, command.correlationId);
    await this.repo.save(ts);
    await this.publisher.publishFromAggregate(ts);
    return {
      success: true,
      data: {
        timesheetId: ts.id.value,
        workerId: ts.workerId.value,
        approvedBy: payload.approvedBy.value,
        status: ts.status,
        periodStart: ts.periodStart.toISOString().slice(0, 10),
        periodEnd: ts.periodEnd.toISOString().slice(0, 10),
        totalHours: ts.totalHours,
        amount: ts.totalHours,
        currency: resolveTenantCurrency(setup),
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ts.id,
      newState: ts.status,
      newVersion: ts.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ts.status, 'Timesheet'),
      eventsEmitted: ts.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
      fieldAccessDecisions: {},
    } as CommandResult<unknown>;
  }
}
