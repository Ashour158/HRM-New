import type { Transaction } from 'kysely';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope, CommandOutcome, CommandError } from '@hcm/command-contracts';
import type { RedisCacheService } from '@hcm/platform-core';
import { makeError } from '../command-bus-errors.js';
import { CommandPipelineStep } from '@hcm/command-contracts';

/**
 * Idempotency key lifecycle: fast Redis-cached lookup, in-transaction
 * reservation, hash-mismatch rejection, and success/error result storage.
 */
export class IdempotencyStep {
  constructor(private readonly redisCache: RedisCacheService) {}

  private cacheKey(command: HrCommandEnvelope<unknown>): string {
    return `idempotency:${command.tenantId.value}:${command.idempotencyKey}`;
  }

  async fastLookup(command: HrCommandEnvelope<unknown>): Promise<CommandOutcome<unknown> | undefined> {
    return this.redisCache.get<CommandOutcome<unknown>>(this.cacheKey(command));
  }

  async reserveKey(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
  ): Promise<void> {
    const requestHash = command.metadata.requestHash;
    await tx
      .insertInto('idempotency_keys')
      .values({
        id: crypto.randomUUID(),
        tenant_id: command.tenantId.value,
        key: command.idempotencyKey,
        hash: requestHash,
        status: 'PENDING',
        command_name: command.commandName,
        aggregate_type: command.aggregateType,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async rejectHashMismatch(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
  ): Promise<void> {
    const existing = await tx
      .selectFrom('idempotency_keys')
      .select(['hash'])
      .where('tenant_id', '=', command.tenantId.value)
      .where('key', '=', command.idempotencyKey)
      .executeTakeFirst();

    if (existing && existing.hash !== command.metadata.requestHash) {
      throw makeError(
        command,
        CommandPipelineStep.REJECT_SAME_KEY_DIFFERENT_HASH,
        'IDEMPOTENCY_HASH_MISMATCH',
        'Idempotency key exists with different request hash',
        false,
      );
    }
  }

  async storeResult(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: unknown,
  ): Promise<void> {
    await tx
      .updateTable('idempotency_keys')
      .set({ status: 'SUCCESS' })
      .where('tenant_id', '=', command.tenantId.value)
      .where('key', '=', command.idempotencyKey)
      .execute();

    await this.redisCache.set(this.cacheKey(command), result, 86400);
  }

  async storeError(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    error: CommandError,
  ): Promise<void> {
    await tx
      .updateTable('idempotency_keys')
      .set({ status: 'FAILED' })
      .where('tenant_id', '=', command.tenantId.value)
      .where('key', '=', command.idempotencyKey)
      .execute();

    await this.redisCache.set(this.cacheKey(command), error, 86400);
  }
}
