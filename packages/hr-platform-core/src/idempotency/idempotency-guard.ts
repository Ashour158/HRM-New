/**
 * Idempotency guard for the command pipeline.
 */

import { DomainError } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { CommandResult, CommandError } from '@hcm/command-contracts';
import { computeRequestHash } from '../crypto/hash.js';
import type { IdempotencyStore } from './idempotency-store.js';

/**
 * Error raised when the same idempotency key is reused with a different payload.
 */
export class IdempotencyMismatchError extends DomainError {
  readonly code = 'IDEMPOTENCY_MISMATCH';

  constructor(key: string) {
    super(`Idempotency key ${key} was reused with a different payload`, { key });
  }
}

/**
 * Possible outcomes of an idempotency check.
 */
export type IdempotencyCheckResult =
  | { status: 'NEW' }
  | { status: 'SUCCESS'; result: CommandResult<unknown> }
  | { status: 'FAILED'; error: CommandError }
  | { status: 'MISMATCH' };

/**
 * Guards command execution by enforcing idempotency rules.
 */
export class IdempotencyGuard {
  /**
   * @param store - The underlying idempotency store.
   */
  constructor(private readonly store: IdempotencyStore) {}

  /**
   * Checks whether the command is new, already processed, or mismatched.
   * For new commands, reserves the idempotency slot.
   * @param command - The incoming command envelope.
   * @returns The check result.
   */
  async checkAndReserve(
    command: HrCommandEnvelope<unknown>
  ): Promise<IdempotencyCheckResult> {
    const hash = computeRequestHash(command.payload);
    const existing = await this.store.check(
      command.idempotencyKey,
      command.tenantId
    );

    if (!existing) {
      await this.store.reserve(
        command.idempotencyKey,
        command.tenantId,
        hash,
        command.commandName,
        command.aggregateType,
        command.aggregateId
      );
      return { status: 'NEW' };
    }

    const samePayload = await this.store.isSamePayload(
      command.idempotencyKey,
      command.tenantId,
      hash
    );

    if (!samePayload) {
      return { status: 'MISMATCH' };
    }

    if (existing.status === 'SUCCESS' && existing.result) {
      return { status: 'SUCCESS', result: existing.result as unknown as CommandResult<unknown> };
    }

    if (existing.status === 'FAILED' && existing.error) {
      return { status: 'FAILED', error: existing.error as unknown as CommandError };
    }

    // PENDING or incomplete entry — treat as new to allow continuation
    return { status: 'NEW' };
  }

  /**
   * Stores a successful result against the command's idempotency key.
   * @param command - The command envelope.
   * @param result - The successful result.
   */
  async storeResult(
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>
  ): Promise<void> {
    await this.store.storeResult(command.idempotencyKey, command.tenantId, result);
  }

  /**
   * Stores a failed outcome against the command's idempotency key.
   * @param command - The command envelope.
   * @param error - The command error.
   */
  async storeError(
    command: HrCommandEnvelope<unknown>,
    error: CommandError
  ): Promise<void> {
    await this.store.storeError(command.idempotencyKey, command.tenantId, error);
  }
}
