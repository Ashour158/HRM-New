import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { TimeClockEvent, type TimeClockEventType } from '../aggregates/time-clock-event.aggregate.js';
import { TimeClockEventRepository } from '../repositories/time-clock-event.repository.js';
import { TimeAttendanceEventsPublisher } from '../events/time-attendance-events.publisher.js';

@CommandHandler('RecordTimeClockEvent')
@Injectable()
export class RecordTimeClockEventHandler {
  constructor(
    private readonly repo: TimeClockEventRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: TimeAttendanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      eventType: TimeClockEventType;
      timestamp: Date;
      location?: string;
      deviceId?: string;
    };
    const ev = TimeClockEvent.record(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        eventType: payload.eventType,
        timestamp: payload.timestamp,
        location: payload.location,
        deviceId: payload.deviceId,
      },
      command.correlationId,
    );
    await this.repo.save(ev);
    await this.publisher.publishFromAggregate(ev);
    return {
      success: true,
      data: { timeClockEventId: ev.id.value, status: ev.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ev.id,
      newState: ev.status,
      newVersion: ev.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ev.status, 'TimeClockEvent'),
      eventsEmitted: ev.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    fieldAccessDecisions: {},
    } as CommandResult<unknown>;
  }
}
