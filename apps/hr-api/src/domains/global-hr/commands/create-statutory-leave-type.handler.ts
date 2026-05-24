import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { StatutoryLeaveType } from '../aggregates/statutory-leave-type.aggregate.js';
import { StatutoryLeaveTypeRepository } from '../repositories/statutory-leave-type.repository.js';
import { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';

export interface CreateStatutoryLeaveTypePayload {
  leaveTypeId: string;
  countryCode: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  minimumEntitlement: number;
  unit: string;
  carryoverAllowed: boolean;
  maxCarryover: number;
  effectiveFrom: Date;
}

/**
 * Handler for the CreateStatutoryLeaveType command.
 */
@Injectable()
@CommandHandler('CreateStatutoryLeaveType')
export class CreateStatutoryLeaveTypeHandler implements ICommandHandler {
  readonly commandName = 'CreateStatutoryLeaveType';

  constructor(
    private readonly repo: StatutoryLeaveTypeRepository,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateStatutoryLeaveTypePayload;

    const leaveType = StatutoryLeaveType.create(
      {
        id: new Uuid(payload.leaveTypeId),
        tenantId: command.tenantId,
        countryCode: payload.countryCode,
        leaveTypeCode: payload.leaveTypeCode,
        leaveTypeName: payload.leaveTypeName,
        minimumEntitlement: payload.minimumEntitlement,
        unit: payload.unit,
        carryoverAllowed: payload.carryoverAllowed,
        maxCarryover: payload.maxCarryover,
        effectiveFrom: payload.effectiveFrom,
      },
      command.correlationId,
    );

    await this.repo.save(leaveType);
    await this.eventsPublisher.publishUncommitted(leaveType, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { leaveTypeId: leaveType.id.value, status: leaveType.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: leaveType.id,
      newState: leaveType.status,
      newVersion: leaveType.aggregateVersion,
      allowedNextActions: ['UpdateStatutoryLeaveType', 'SupersedeStatutoryLeaveType'],
      fieldAccessDecisions: {},
      eventsEmitted: leaveType.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
