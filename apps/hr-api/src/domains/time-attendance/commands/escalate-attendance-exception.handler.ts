import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { AttendanceExceptionRepository } from '../repositories/attendance-exception.repository.js';
import { TimeAttendanceEventsPublisher } from '../events/time-attendance-events.publisher.js';

@CommandHandler('EscalateAttendanceException')
@Injectable()
export class EscalateAttendanceExceptionHandler {
  constructor(
    private readonly repo: AttendanceExceptionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: TimeAttendanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { attendanceExceptionId: Uuid };
    const ex = await this.repo.findById(payload.attendanceExceptionId);
    if (!ex) throw new Error('Attendance exception not found');
    ex.escalate(command.correlationId);
    await this.repo.save(ex);
    await this.publisher.publishFromAggregate(ex);
    return {
      success: true,
      data: { attendanceExceptionId: ex.id.value, status: ex.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ex.id,
      newState: ex.status,
      newVersion: ex.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ex.status, 'AttendanceException'),
      eventsEmitted: ex.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
