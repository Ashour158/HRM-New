import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PayrollInputRepository } from '../repositories/payroll-input.repository.js';
import { PayrollEventsPublisher } from '../events/payroll-events.publisher.js';

@CommandHandler('ApprovePayrollInput')
@Injectable()
export class ApprovePayrollInputHandler {
  constructor(
    private readonly repo: PayrollInputRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PayrollEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { payrollInputId: Uuid };
    const pi = await this.repo.findById(payload.payrollInputId);
    if (!pi) throw new Error('Payroll input not found');
    pi.approve(command.correlationId);
    await this.repo.save(pi);
    await this.publisher.publishFromAggregate(pi);
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
