import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../kysely/database.js';
import { getCurrentTransaction } from '../connection/transaction-context.js';

/**
 * Transaction-aware repository pattern
 * ====================================
 *
 * `CommandBus.execute()` (apps/hr-api/src/platform/command-bus/command-bus.ts)
 * opens one real Postgres transaction per command and threads it through
 * `AsyncLocalStorage` via `runWithTransaction()` while it calls
 * `handler.handle()`. The audit record, outbox event, transition ledger row,
 * and idempotency key are all written against that same transaction — so for
 * the domain state write (inside `handler.handle()`, typically
 * `repository.save(entity)`) to be atomic with them, the repository has to
 * join that ambient transaction too, instead of opening its own separate
 * autocommit connection (which is what a repository gets by default from
 * `createKyselyInstance(getPool())`).
 *
 * `resolveTransactionAwareExecutor` is the one place that implements the
 * join-if-present-else-fall-back-to-the-pool rule:
 *
 *   - Inside a command handler (i.e. inside `runWithTransaction`),
 *     `getCurrentTransaction()` returns the command's transaction, and the
 *     repository's write becomes part of it. If a later step in the same
 *     command (writing the audit record, for example) fails, Postgres
 *     aborts the whole transaction and this write rolls back with it.
 *   - Outside a command handler (background jobs, migrations, scheduler
 *     reads, anything that never ran inside `runWithTransaction`),
 *     `getCurrentTransaction()` returns `undefined` and the repository falls
 *     back to its own pooled connection exactly as before — behavior is
 *     unchanged for every context that doesn't use the command bus.
 *
 * Two ways to opt a repository in:
 *
 *   1. Extend `BaseRepository` (see `./base-repository.ts`) and use its
 *      generic `findById`/`findAll`/`insert`/`update`/`delete` methods,
 *      which already route through `this.executor` (a thin wrapper around
 *      this same function). Any *custom* query method the repository adds
 *      on top (a bespoke `findByEmail`, a raw `insertInto(...).onConflict(...)`
 *      upsert, etc) should use `this.executor` instead of `this.db` too —
 *      that's the "minimal, obvious change" per call site.
 *   2. For a repository that can't/doesn't extend `BaseRepository` (custom
 *      row shape, bespoke upsert logic, etc), add one line —
 *      `private get executor() { return resolveTransactionAwareExecutor(this.db); }`
 *      — and use `this.executor` instead of `this.db` in its query methods.
 *
 * Adopted so far: the `payroll`, `compensation`, and `hr-core`
 * (`WorkerRepository`, `PersonalDataRecordRepository`) domains from the
 * original command-bus tx-atomicity decomposition, plus `CountryRuleSetRepository`
 * and `StatutoryLeaveTypeRepository` in the `global-hr` domain (tenant-isolation
 * hardening follow-up to PR #117) — see each repository file for the `executor`
 * getter / inherited `BaseRepository` usage. All other repositories in the
 * codebase (~120+ across the remaining domains) still construct their own
 * pooled `Kysely` instance and write outside the command's transaction;
 * adopting this pattern for them is intentionally out of scope here (a
 * repo-wide rollout needs its own staged effort, not a drive-by change
 * bundled with an unrelated fix). Do not assume any repository outside the
 * ones named above is transaction-safe.
 */
export function resolveTransactionAwareExecutor<DB = Database>(
  pooledDb: Kysely<DB>,
): Kysely<DB> | Transaction<DB> {
  const currentTransaction = getCurrentTransaction() as unknown as Transaction<DB> | undefined;
  return currentTransaction ?? pooledDb;
}
