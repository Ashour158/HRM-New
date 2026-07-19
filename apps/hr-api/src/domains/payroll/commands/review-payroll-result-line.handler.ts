import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PayrollResultLineRepository } from '../repositories/payroll-result-line.repository.js';

@CommandHandler('ReviewPayrollResultLine')
@Injectable()
export class ReviewPayrollResultLineHandler {
  constructor(
    private readonly repo: PayrollResultLineRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { payrollResultLineId: Uuid };
    const line = await this.repo.findById(payload.payrollResultLineId);
    if (!line) throw new Error('Payroll result line not found');
    line.review(command.correlationId);
    await this.repo.save(line);
    return {
      success: true,
      data: { payrollResultLineId: line.id.value, status: line.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: line.id,
      newState: line.status,
      newVersion: line.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(line.status, 'PayrollResultLine'),
      eventsEmitted: line.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
