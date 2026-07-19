import type { Transaction } from 'kysely';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';

/**
 * Placeholder pipeline marker for "the authoritative business-state write".
 *
 * The actual write does not happen here: it happens earlier, inside
 * `handler.handle()`, which the orchestrator invokes via
 * `runWithTransaction(tx, () => handler.handle(command))` so that any
 * transaction-aware repository (see `BaseRepository.executor` and
 * `resolveTransactionAwareExecutor` in `@hcm/database`) joins this same `tx`
 * instead of opening its own autocommit connection. That is what makes the
 * domain state write atomic with the audit record, outbox event, transition
 * ledger row, and idempotency key written later in this same transaction —
 * if any of those later writes fails, Postgres aborts the whole transaction
 * and the state write rolls back with it.
 *
 * This step remains a no-op (matching pre-refactor behavior exactly) so the
 * pipeline step enum / logging around `WRITE_AUTHORITATIVE_STATE` is
 * preserved for observability, without duplicating the write.
 */
export class StateWriteStep {
  async write(
    _tx: Transaction<Database>,
    _command: HrCommandEnvelope<unknown>,
    _result: CommandResult<unknown>,
  ): Promise<void> {
    return;
  }
}
