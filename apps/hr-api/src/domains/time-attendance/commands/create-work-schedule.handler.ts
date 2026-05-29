import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkSchedule } from '../aggregates/work-schedule.aggregate.js';
import { WorkScheduleRepository } from '../repositories/work-schedule.repository.js';
import { TimeAttendanceEventsPublisher } from '../events/time-attendance-events.publisher.js';

@CommandHandler('CreateWorkSchedule')
@Injectable()
export class CreateWorkScheduleHandler {
  constructor(
    private readonly repo: WorkScheduleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: TimeAttendanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      scheduleType: string;
      startDate: Date;
      endDate?: Date;
      daysOfWeek?: string[];
      hoursPerDay?: number;
      timezone: string;
    };
    const ws = WorkSchedule.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        scheduleType: payload.scheduleType,
        startDate: payload.startDate,
        endDate: payload.endDate,
        daysOfWeek: payload.daysOfWeek ?? [],
        hoursPerDay: payload.hoursPerDay ?? 0,
        timezone: payload.timezone,
      },
      command.correlationId,
    );
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
    fieldAccessDecisions: {},
    } as CommandResult<unknown>;
  }
}
