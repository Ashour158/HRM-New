import { describe, it, expect, beforeEach } from 'vitest';
import { PostgresIdempotencyStore } from './idempotency-store.js';
import { Uuid } from '@hcm/shared-kernel';
import type { Kysely } from 'kysely';
import type { Database } from '@hcm/database';

describe('PostgresIdempotencyStore', () => {
  let store: PostgresIdempotencyStore;
  let rows: Array<Record<string, unknown>>;

  beforeEach(() => {
    rows = [];

    const mockDb = {
      insertInto: () => ({
        values: (values: Record<string, unknown>) => {
          rows.push(values);
          return {
            execute: async () => ({ numInsertedOrUpdatedRows: BigInt(1) }),
          };
        },
      }),
      selectFrom: (_table: string) => ({
        selectAll: () => ({
          where: () => ({
            executeTakeFirst: async () => rows[0] ?? undefined,
          }),
        }),
        select: (_cols: string[]) => ({
          where: () => ({
            executeTakeFirst: async () => rows[0] ?? undefined,
          }),
        }),
      }),
      updateTable: (_table: string) => ({
        set: (_values: Record<string, unknown>) => ({
          where: () => ({
            execute: async () => ({ numUpdatedRows: BigInt(1) }),
          }),
        }),
      }),
      deleteFrom: (_table: string) => ({
        where: () => ({
          executeTakeFirst: async () => ({ numDeletedRows: BigInt(0) }),
        }),
      }),
    } as unknown as Kysely<Database>;

    store = new PostgresIdempotencyStore(mockDb, 24);
  });

  it('reserves an idempotency key with command metadata', async () => {
    const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
    await store.reserve(
      'test-key-1',
      tenantId,
      'hash-abc',
      'CreateWorker',
      'WorkerProfile',
      new Uuid('11111111-1111-1111-1111-111111111111')
    );

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.key).toBe('test-key-1');
    expect(row.tenant_id).toBe(tenantId.value);
    expect(row.hash).toBe('hash-abc');
    expect(row.status).toBe('PENDING');
    expect(row.command_name).toBe('CreateWorker');
    expect(row.aggregate_type).toBe('WorkerProfile');
    expect(row.aggregate_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(row.expires_at).toBeInstanceOf(Date);
  });

  it('reserves without aggregateId for creation commands', async () => {
    const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
    await store.reserve(
      'test-key-2',
      tenantId,
      'hash-def',
      'CreateWorker',
      'WorkerProfile'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].command_name).toBe('CreateWorker');
    expect(rows[0].aggregate_type).toBe('WorkerProfile');
    expect(rows[0].aggregate_id).toBeNull();
  });
});
