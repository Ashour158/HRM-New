import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PayrollCycle } from '../aggregates/payroll-cycle.aggregate.js';
import { PayrollCycleRepository } from '../repositories/payroll-cycle.repository.js';

@CommandHandler('CreatePayrollCycle')
@Injectable()
export class CreatePayrollCycleHandler {
  constructor(
    private readonly repo: PayrollCycleRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { cycleName: string; payPeriodStart: Date; payPeriodEnd: Date; payDate?: Date };
    const pc = PayrollCycle.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        cycleName: payload.cycleName,
        payPeriodStart: payload.payPeriodStart,
        payPeriodEnd: payload.payPeriodEnd,
        payDate: payload.payDate,
        createdBy: command.actor.actorId,
      },
      command.correlationId,
    );
    await this.repo.save(pc);
    return {
      success: true,
      data: { payrollCycleId: pc.id.value, status: pc.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: pc.id,
      newState: pc.status,
      newVersion: pc.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(pc.status, 'PayrollCycle'),
      eventsEmitted: pc.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
