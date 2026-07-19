import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { StatutoryLeaveTypeRepository } from '../repositories/statutory-leave-type.repository.js';
import { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';

type UpdateStatutoryLeaveTypePayload = {
  leaveTypeId: Uuid;
  leaveTypeName?: string;
  minimumEntitlement?: number;
  unit?: string;
  carryoverAllowed?: boolean;
  maxCarryover?: number;
};

type SupersedeStatutoryLeaveTypePayload = {
  leaveTypeId: Uuid;
};

function statutoryLeaveTypeResult(
  command: HrCommandEnvelope<unknown>,
  fsm: FsmFramework,
  leaveType: Awaited<ReturnType<StatutoryLeaveTypeRepository['findByIdForTenant']>>,
): CommandResult<unknown> {
  if (!leaveType) throw new Error('Statutory leave type not found');
  return {
    success: true,
    data: { leaveTypeId: leaveType.id.value, status: leaveType.status },
    commandId: command.commandId,
    correlationId: command.correlationId,
    aggregateId: leaveType.id,
    newState: leaveType.status,
    newVersion: leaveType.aggregateVersion,
    allowedNextActions: fsm.getAllowedActionsFromState(leaveType.status, 'StatutoryLeaveType'),
    fieldAccessDecisions: {},
    eventsEmitted: leaveType.domainEvents.map((event) => event.eventName),
    auditRecordId: command.commandId,
  };
}

/**
 * Updates mutable fields of a StatutoryLeaveType (ACTIVE → ACTIVE).
 */
@CommandHandler('UpdateStatutoryLeaveType')
@Injectable()
export class UpdateStatutoryLeaveTypeHandler {
  readonly commandName = 'UpdateStatutoryLeaveType';

  constructor(
    private readonly repo: StatutoryLeaveTypeRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as UpdateStatutoryLeaveTypePayload;
    const leaveType = await this.repo.findByIdForTenant(payload.leaveTypeId, command.tenantId);
    if (!leaveType) throw new Error('Statutory leave type not found');
    leaveType.update(
      {
        leaveTypeName: payload.leaveTypeName,
        minimumEntitlement: payload.minimumEntitlement,
        unit: payload.unit,
        carryoverAllowed: payload.carryoverAllowed,
        maxCarryover: payload.maxCarryover,
      },
      command.correlationId,
    );
    await this.repo.save(leaveType);
    await this.eventsPublisher.publishUncommitted(leaveType, command.tenantId, command.correlationId);
    return statutoryLeaveTypeResult(command, this.fsm, leaveType);
  }
}

/**
 * Supersedes a StatutoryLeaveType (ACTIVE → SUPERSEDED), typically when a
 * revised statutory entitlement replaces it.
 */
@CommandHandler('SupersedeStatutoryLeaveType')
@Injectable()
export class SupersedeStatutoryLeaveTypeHandler {
  readonly commandName = 'SupersedeStatutoryLeaveType';

  constructor(
    private readonly repo: StatutoryLeaveTypeRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as SupersedeStatutoryLeaveTypePayload;
    const leaveType = await this.repo.findByIdForTenant(payload.leaveTypeId, command.tenantId);
    if (!leaveType) throw new Error('Statutory leave type not found');
    leaveType.supersede(command.correlationId);
    await this.repo.save(leaveType);
    await this.eventsPublisher.publishUncommitted(leaveType, command.tenantId, command.correlationId);
    return statutoryLeaveTypeResult(command, this.fsm, leaveType);
  }
}
