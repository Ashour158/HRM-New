import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PayrollCalculationRunRepository } from '../repositories/payroll-calculation-run.repository.js';

@CommandHandler('FailPayrollCalculationRun')
@Injectable()
export class FailPayrollCalculationRunHandler {
  constructor(
    private readonly repo: PayrollCalculationRunRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { payrollCalculationRunId: Uuid };
    const run = await this.repo.findById(payload.payrollCalculationRunId);
    if (!run) throw new Error('Payroll calculation run not found');
    run.fail(command.correlationId);
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
