import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { AbsenceAccrualBalance } from '../aggregates/absence-accrual-balance.aggregate.js';
import { AbsenceAccrualBalanceRepository } from '../repositories/absence-accrual-balance.repository.js';
import { AbsenceBalanceMovementRepository } from '../repositories/absence-balance-movement.repository.js';
import { AbsenceLeaveEventsPublisher } from '../events/absence-leave-events.publisher.js';

@CommandHandler('CreateAbsenceAccrualBalance')
@Injectable()
export class CreateAbsenceAccrualBalanceHandler {
  constructor(
    private readonly repo: AbsenceAccrualBalanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: AbsenceLeaveEventsPublisher,
    private readonly movementRepo?: AbsenceBalanceMovementRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      leaveType: string;
      balanceHours: number;
      accruedHours: number;
      usedHours: number;
      carriedOverHours: number;
      effectiveDate: Date;
    };
    const ab = AbsenceAccrualBalance.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        leaveType: payload.leaveType,
        balanceHours: payload.balanceHours,
        accruedHours: payload.accruedHours,
        usedHours: payload.usedHours,
        carriedOverHours: payload.carriedOverHours,
        effectiveDate: payload.effectiveDate,
      },
      command.correlationId,
    );
    await this.repo.save(ab);
    await this.movementRepo?.insertMovement({
      tenantId: ab.tenantId,
      workerId: ab.workerId,
      balanceId: ab.id,
      leaveType: ab.leaveType,
      movementType: 'ACCRUAL',
      sourceType: 'AbsenceAccrualBalance',
      sourceId: ab.id,
      amountHours: ab.balanceHours,
      beforeHours: 0,
      afterHours: ab.balanceHours,
      correlationId: command.correlationId,
    });
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
