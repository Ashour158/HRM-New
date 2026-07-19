import type { Transaction } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { inferActionFromCommand } from '../command-bus.utils.js';
import { TransitionLedgerService } from '../../workflow/transition-ledger.js';

/** Records the state transition ledger row for a successfully executed command. */
export class TransitionLedgerStep {
  constructor(private readonly transitionLedger: TransitionLedgerService) {}

  async write(
    _tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
  ): Promise<void> {
    await this.transitionLedger.recordTransition({
      id: Uuid.generate(),
      tenantId: command.tenantId,
      aggregateType: command.aggregateType,
      aggregateId: result.aggregateId,
      fromState: command.expectedState ?? 'INITIAL',
      toState: result.newState,
      action: inferActionFromCommand(command.commandName),
      triggeredBy: command.actor.actorId.value,
      occurredAt: new Date(),
      correlationId: command.correlationId,
      commandId: command.commandId,
    });
  }
}
