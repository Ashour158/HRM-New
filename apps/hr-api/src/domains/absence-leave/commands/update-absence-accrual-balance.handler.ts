import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { AbsenceAccrualBalanceRepository } from '../repositories/absence-accrual-balance.repository.js';
import { AbsenceBalanceMovementRepository } from '../repositories/absence-balance-movement.repository.js';
import { AbsenceLeaveEventsPublisher } from '../events/absence-leave-events.publisher.js';

@CommandHandler('UpdateAbsenceAccrualBalance')
@Injectable()
export class UpdateAbsenceAccrualBalanceHandler {
  constructor(
    private readonly repo: AbsenceAccrualBalanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: AbsenceLeaveEventsPublisher,
    private readonly movementRepo?: AbsenceBalanceMovementRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { balanceId: Uuid; balanceHours?: number; accruedHours?: number; usedHours?: number };
    const ab = await this.repo.findById(payload.balanceId);
    if (!ab) throw new Error('Accrual balance not found');
    const beforeHours = ab.balanceHours;
    ab.update({ balanceHours: payload.balanceHours, accruedHours: payload.accruedHours, usedHours: payload.usedHours }, command.correlationId);
    await this.repo.save(ab);
    if (beforeHours !== ab.balanceHours) {
      await this.movementRepo?.insertMovement({
        tenantId: ab.tenantId,
        workerId: ab.workerId,
        balanceId: ab.id,
        leaveType: ab.leaveType,
        movementType: 'ADJUSTMENT',
        sourceType: 'ManualBalanceAdjustment',
        sourceId: command.commandId,
        amountHours: ab.balanceHours - beforeHours,
        beforeHours,
        afterHours: ab.balanceHours,
        correlationId: command.correlationId,
      });
    }
    await this.publisher.publishFromAggregate(ab);
    return {
      success: true,
      data: { absenceAccrualBalanceId: ab.id.value, status: ab.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ab.id,
      newState: ab.status,
      newVersion: ab.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ab.status, 'AbsenceAccrualBalance'),
      eventsEmitted: ab.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
