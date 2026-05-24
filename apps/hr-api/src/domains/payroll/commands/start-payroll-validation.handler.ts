import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PayrollCycleRepository } from '../repositories/payroll-cycle.repository.js';
import { PayrollEventsPublisher } from '../events/payroll-events.publisher.js';

@CommandHandler('StartPayrollValidation')
@Injectable()
export class StartPayrollValidationHandler {
  constructor(
    private readonly repo: PayrollCycleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PayrollEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { payrollCycleId: Uuid };
    const pc = await this.repo.findById(payload.payrollCycleId);
    if (!pc) throw new Error('Payroll cycle not found');
    pc.startValidation(command.correlationId);
    await this.repo.save(pc);
    await this.publisher.publishFromAggregate(pc);
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
