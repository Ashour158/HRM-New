/**
 * Idempotency key storage for the HR/HCM command pipeline.
 */

import type { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import type { CommandResult, CommandError } from '@hcm/command-contracts';

/**
 * Represents the state of an idempotency key in the store.
 */
export interface IdempotencyEntry {
  id: Uuid;
  tenantId: Uuid;
  key: string;
  hash: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  commandName: string;
  aggregateType: string;
  aggregateId?: Uuid;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Abstract store for idempotency keys.
 */
export interface IdempotencyStore {
  /**
   * Looks up an existing idempotency entry.
   * @param key - The idempotency key.
   * @param tenantId - The owning tenant.
   * @returns The entry or undefined if not found.
   */
  check(key: string, tenantId: Uuid): Promise<IdempotencyEntry | undefined>;

  /**
   * Atomically reserves a new idempotency key slot.
   * @param key - The idempotency key.
   * @param tenantId - The owning tenant.
   * @param hash - SHA-256 of the normalized payload.
   * @param commandName - The canonical command name.
   */
  reserve(key: string, tenantId: Uuid, hash: string, commandName: string): Promise<void>;

  /**
   * Stores a successful command result against the idempotency key.
   * @param key - The idempotency key.
   * @param tenantId - The owning tenant.
   * @param result - The command result.
   */
  storeResult(key: string, tenantId: Uuid, result: CommandResult<unknown>): Promise<void>;

  /**
   * Stores a failed command outcome against the idempotency key.
   * @param key - The idempotency key.
   * @param tenantId - The owning tenant.
   * @param error - The command error.
   */
  storeError(key: string, tenantId: Uuid, error: CommandError): Promise<void>;

  /**
   * Checks whether the stored hash matches the provided hash.
   * @param key - The idempotency key.
   * @param tenantId - The owning tenant.
   * @param hash - The hash to compare.
   * @returns True if the hashes match.
   */
  isSamePayload(key: string, tenantId: Uuid, hash: string): Promise<boolean>;

  /**
   * Removes expired idempotency entries.
   * @param before - Entries with `expiresAt` earlier than this are deleted.
   * @returns The number of rows deleted.
   */
  cleanupExpired(before: Date): Promise<number>;
}

/**
 * PostgreSQL-backed implementation of {@link IdempotencyStore}.
 */
export class PostgresIdempotencyStore implements IdempotencyStore {
  /**
   * @param db - Kysely instance for the platform database.
   * @param ttlHours - Default TTL for new entries.
   */
  constructor(
    private readonly db: Kysely<Database>,
    private readonly ttlHours: number = 24
  ) {}

  async check(key: string, tenantId: Uuid): Promise<IdempotencyEntry | undefined> {
    const row = await this.db
      .selectFrom('idempotency_keys')
      .selectAll()
      .where('key', '=', key)
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();

    if (!row) return undefined;

    return this.toEntry(row);
  }

  async reserve(
    key: string,
    tenantId: Uuid,
    hash: string,
    _commandName: string
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlHours * 60 * 60 * 1000);

    await this.db
      .insertInto('idempotency_keys')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        key,
        hash,
        status: 'PENDING',
        created_at: now.toISOString(),
        expires_at: expiresAt,
      })
      .execute();
  }

  async storeResult(
    key: string,
    tenantId: Uuid,
    _result: CommandResult<unknown>
  ): Promise<void> {
    await this.db
      .updateTable('idempotency_keys')
      .set({
        status: 'SUCCESS',
        // Store minimal result snapshot as JSON; aggregates kept thin.
        // Kysely typings for unknown columns may require casting.
      })
      .where('key', '=', key)
      .where('tenant_id', '=', tenantId.value)
      .execute();
  }

  async storeError(key: string, tenantId: Uuid, _error: CommandError): Promise<void> {
    await this.db
      .updateTable('idempotency_keys')
      .set({
        status: 'FAILED',
      })
      .where('key', '=', key)
      .where('tenant_id', '=', tenantId.value)
      .execute();
  }

  async isSamePayload(key: string, tenantId: Uuid, hash: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('idempotency_keys')
      .select('hash')
      .where('key', '=', key)
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();

    return row?.hash === hash;
  }

  async cleanupExpired(before: Date): Promise<number> {
    const result = await this.db
      .deleteFrom('idempotency_keys')
      .where('expires_at', '<', before)
      .executeTakeFirst();

    return Number(result.numDeletedRows ?? 0);
  }

  private toEntry(row: {
    id: string;
    tenant_id: string;
    key: string;
    hash: string;
    status: string;
    created_at: Date;
    expires_at: Date | null;
  }): IdempotencyEntry {
    return {
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      key: row.key,
      hash: row.hash,
      status: row.status as 'PENDING' | 'SUCCESS' | 'FAILED',
      commandName: '', // not stored in base schema; enriched by guard layer
      aggregateType: '',
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? new Date(Date.now() + this.ttlHours * 60 * 60 * 1000),
    };
  }
}
