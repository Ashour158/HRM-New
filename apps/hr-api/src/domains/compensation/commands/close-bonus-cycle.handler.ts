import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { BonusCycleRepository } from '../repositories/bonus-cycle.repository.js';
import { BonusCycleFsm } from '../fsm/bonus-cycle.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for closing a BonusCycle.
 */
@Injectable()
@CommandHandler('CloseBonusCycle')
export class CloseBonusCycleHandler implements ICommandHandler {
  commandName = 'CloseBonusCycle' as const;

  constructor(
    private readonly repo: BonusCycleRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: BonusCycleFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { cycleId: Uuid };
    const cycle = await this.repo.findById(payload.cycleId);
    if (!cycle) throw new Error('BonusCycle not found');

    cycle.close(command.correlationId);
    await this.repo.save(cycle);
    const eventsEmitted = cycle.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(cycle, command);

    return {
      success: true,
      data: { cycleId: cycle.id.value, status: cycle.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: cycle.id,
      newState: cycle.status,
      newVersion: cycle.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(cycle.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
