import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OpenShift } from '../aggregates/open-shift.aggregate.js';
import { OpenShiftRepository } from '../repositories/open-shift.repository.js';
import { WorkforceManagementEventsPublisher } from '../events/workforce-management-events.publisher.js';

@CommandHandler('CreateOpenShift')
@Injectable()
export class CreateOpenShiftHandler {
  constructor(
    private readonly repo: OpenShiftRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WorkforceManagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      departmentId: Uuid;
      shiftDate: Date;
      startTime: Date;
      endTime: Date;
      requiredSkills?: string[];
      bidDeadline?: Date;
    };
    const ar = OpenShift.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        departmentId: payload.departmentId,
        shiftDate: payload.shiftDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        requiredSkills: payload.requiredSkills,
        bidDeadline: payload.bidDeadline,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { openShiftId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'OpenShift'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
