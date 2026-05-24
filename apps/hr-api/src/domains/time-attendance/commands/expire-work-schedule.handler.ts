import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkScheduleRepository } from '../repositories/work-schedule.repository.js';
import { TimeAttendanceEventsPublisher } from '../events/time-attendance-events.publisher.js';

@CommandHandler('ExpireWorkSchedule')
@Injectable()
export class ExpireWorkScheduleHandler {
  constructor(
    private readonly repo: WorkScheduleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: TimeAttendanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workScheduleId: Uuid };
    const ws = await this.repo.findById(payload.workScheduleId);
    if (!ws) throw new Error('Work schedule not found');
    ws.expire(command.correlationId);
    await this.repo.save(ws);
    await this.publisher.publishFromAggregate(ws);
    return {
      success: true,
      data: { workScheduleId: ws.id.value, status: ws.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ws.id,
      newState: ws.status,
      newVersion: ws.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ws.status, 'WorkSchedule'),
      eventsEmitted: ws.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
