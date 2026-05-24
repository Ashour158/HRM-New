import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ShiftSchedule } from '../aggregates/shift-schedule.aggregate.js';
import { ShiftScheduleRepository } from '../repositories/shift-schedule.repository.js';
import { WorkforceManagementEventsPublisher } from '../events/workforce-management-events.publisher.js';

@CommandHandler('CreateShiftSchedule')
@Injectable()
export class CreateShiftScheduleHandler {
  constructor(
    private readonly repo: ShiftScheduleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WorkforceManagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      shiftDate: Date;
      startTime: Date;
      endTime: Date;
      breakDuration: number;
      departmentId: Uuid;
    };
    const ar = ShiftSchedule.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        shiftDate: payload.shiftDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        breakDuration: payload.breakDuration,
        departmentId: payload.departmentId,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { shiftScheduleId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ShiftSchedule'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
