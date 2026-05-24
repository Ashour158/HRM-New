import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Timesheet, type TimesheetEntry } from '../aggregates/timesheet.aggregate.js';
import { TimesheetRepository } from '../repositories/timesheet.repository.js';
import { TimeAttendanceEventsPublisher } from '../events/time-attendance-events.publisher.js';

@CommandHandler('CreateTimesheet')
@Injectable()
export class CreateTimesheetHandler {
  constructor(
    private readonly repo: TimesheetRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: TimeAttendanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      periodStart: Date;
      periodEnd: Date;
      entries?: TimesheetEntry[];
    };
    const ts = Timesheet.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        entries: payload.entries,
      },
      command.correlationId,
    );
    await this.repo.save(ts);
    await this.publisher.publishFromAggregate(ts);
    return {
      success: true,
      data: { timesheetId: ts.id.value, status: ts.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ts.id,
      newState: ts.status,
      newVersion: ts.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ts.status, 'Timesheet'),
      eventsEmitted: ts.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
