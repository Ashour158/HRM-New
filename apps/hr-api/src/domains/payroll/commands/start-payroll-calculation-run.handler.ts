import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PayrollCalculationRun } from '../aggregates/payroll-calculation-run.aggregate.js';
import { PayrollCalculationRunRepository } from '../repositories/payroll-calculation-run.repository.js';

@CommandHandler('StartPayrollCalculationRun')
@Injectable()
export class StartPayrollCalculationRunHandler {
  constructor(
    private readonly repo: PayrollCalculationRunRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      payrollCycleId: Uuid;
      currency: string;
      totalWorkers?: number;
      totalGrossPay?: number;
      totalNetPay?: number;
    };
    const run = PayrollCalculationRun.start(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        payrollCycleId: payload.payrollCycleId,
        currency: payload.currency,
        totalWorkers: payload.totalWorkers,
        totalGrossPay: payload.totalGrossPay,
        totalNetPay: payload.totalNetPay,
      },
      command.correlationId,
    );
    await this.repo.save(run);
    return {
      success: true,
      data: { payrollCalculationRunId: run.id.value, status: run.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: run.id,
      newState: run.status,
      newVersion: run.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(run.status, 'PayrollCalculationRun'),
      eventsEmitted: run.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
