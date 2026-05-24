import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { LeaveEntitlementCalculation } from '../aggregates/leave-entitlement-calculation.aggregate.js';
import { LeaveEntitlementCalculationRepository } from '../repositories/leave-entitlement-calculation.repository.js';
import { AbsenceLeaveEventsPublisher } from '../events/absence-leave-events.publisher.js';

@CommandHandler('StartLeaveEntitlementCalculation')
@Injectable()
export class StartLeaveEntitlementCalculationHandler {
  constructor(
    private readonly repo: LeaveEntitlementCalculationRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: AbsenceLeaveEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      leaveType: string;
      calculatedEntitlement: number;
      usedEntitlement: number;
      remainingEntitlement: number;
      calculationDate: Date;
    };
    const le = LeaveEntitlementCalculation.start(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        leaveType: payload.leaveType,
        calculatedEntitlement: payload.calculatedEntitlement,
        usedEntitlement: payload.usedEntitlement,
        remainingEntitlement: payload.remainingEntitlement,
        calculationDate: payload.calculationDate,
      },
      command.correlationId,
    );
    await this.repo.save(le);
    await this.publisher.publishFromAggregate(le);
    return {
      success: true,
      data: { leaveEntitlementCalculationId: le.id.value, status: le.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: le.id,
      newState: le.status,
      newVersion: le.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(le.status, 'LeaveEntitlementCalculation'),
      eventsEmitted: le.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
