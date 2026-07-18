import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { BonusCycleRepository } from '../repositories/bonus-cycle.repository.js';
import { BonusCycleFsm } from '../fsm/bonus-cycle.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for approving a BonusCycle's payout pool.
 * REVIEW → APPROVED.
 *
 * SoD note: identity-based proposer/approver separation is not tracked on this
 * aggregate (no single "proposer" field exists on a pool-level payout cycle).
 * Segregation of duties for bonus payouts is enforced centrally by the command
 * bus's SoD matrix (see BONUS_RECOMMENDER_CANNOT_CALIBRATE_APPROVE in
 * packages/hr-access-control/src/sod/sod-matrix.ts), which blocks any actor
 * holding both MANAGER and COMPENSATION_ADMIN roles from executing this command.
 */
@Injectable()
@CommandHandler('ApproveBonusCycle')
export class ApproveBonusCycleHandler implements ICommandHandler {
  commandName = 'ApproveBonusCycle' as const;

  constructor(
    private readonly repo: BonusCycleRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: BonusCycleFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { cycleId: Uuid };
    const cycle = await this.repo.findById(payload.cycleId);
    if (!cycle) throw new Error('BonusCycle not found');

    cycle.approve(command.correlationId);
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
