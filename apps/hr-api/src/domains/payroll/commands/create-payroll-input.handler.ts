import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PayrollInput } from '../aggregates/payroll-input.aggregate.js';
import { PayrollInputRepository } from '../repositories/payroll-input.repository.js';

@CommandHandler('CreatePayrollInput')
@Injectable()
export class CreatePayrollInputHandler {
  constructor(
    private readonly repo: PayrollInputRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workerId: Uuid; payrollCycleId: Uuid; inputType: string; amount: number; currency: string; description?: string };
    const pi = PayrollInput.create(
      { id: Uuid.generate(), tenantId: command.tenantId, workerId: payload.workerId, payrollCycleId: payload.payrollCycleId, inputType: payload.inputType, amount: payload.amount, currency: payload.currency, description: payload.description },
      command.correlationId,
    );
    await this.repo.save(pi);
    return {
      success: true,
      data: { payrollInputId: pi.id.value, status: pi.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: pi.id,
      newState: pi.status,
      newVersion: pi.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(pi.status, 'PayrollInput'),
      eventsEmitted: pi.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
