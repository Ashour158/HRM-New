import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { IdempotencyStep } from './idempotency.step.js';

// Characterization tests for the idempotency key lifecycle (fast Redis
// lookup, in-transaction reservation, hash-mismatch rejection, and
// success/error result storage). This branch previously had no direct
// coverage in command-bus.security.test.ts even though it runs on every
// single command — added here as the regression safety net ahead of, and
// unchanged by, the command-bus pipeline decomposition.

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');

function makeCommand(overrides: Partial<HrCommandEnvelope<unknown>> = {}): HrCommandEnvelope<unknown> {
  return {
    commandId: new Uuid('550e8400-e29b-41d4-a716-446655440011'),
    commandName: 'UpdateWorkerPersonalData',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: new Uuid('550e8400-e29b-41d4-a716-446655440012'),
      roles: ['EMPLOYEE'],
      permissions: [],
      mfaAuthenticated: true,
    },
    aggregateType: 'WorkerProfile',
    aggregateId: new Uuid('550e8400-e29b-41d4-a716-446655440001'),
    idempotencyKey: 'idem-key-1',
    correlationId: new Uuid('550e8400-e29b-41d4-a716-446655440013'),
    reason: 'test',
    payload: {},
    metadata: { requestHash: 'hash-1', clientType: 'EMPLOYEE_PORTAL' },
    ...overrides,
  } as HrCommandEnvelope<unknown>;
}

function fakeTx() {
  const insertValues: Record<string, unknown>[] = [];
  const updateSets: Record<string, unknown>[] = [];
  const wheres: Array<[string, string, unknown]> = [];
  let selectResult: { hash: string } | undefined;

  const insertBuilder = {
    values: (row: Record<string, unknown>) => {
      insertValues.push(row);
      return insertBuilder;
    },
    onConflict: (fn: (oc: { doNothing: () => unknown }) => unknown) => {
      fn({ doNothing: () => undefined });
      return insertBuilder;
    },
    execute: async () => undefined,
  };
  const updateBuilder = {
    set: (row: Record<string, unknown>) => {
      updateSets.push(row);
      return updateBuilder;
    },
    where: (col: string, op: string, val: unknown) => {
      wheres.push([col, op, val]);
      return updateBuilder;
    },
    execute: async () => undefined,
  };
  const selectBuilder = {
    select: () => selectBuilder,
    where: (col: string, op: string, val: unknown) => {
      wheres.push([col, op, val]);
      return selectBuilder;
    },
    executeTakeFirst: async () => selectResult,
  };

  return {
    tx: {
      insertInto: () => insertBuilder,
      updateTable: () => updateBuilder,
      selectFrom: () => selectBuilder,
    },
    insertValues,
    updateSets,
    wheres,
    setSelectResult: (row: { hash: string } | undefined) => { selectResult = row; },
  };
}

function fakeRedis() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown, _ttlSeconds: number) => { store.set(key, value); }),
    store,
  };
}

describe('IdempotencyStep', () => {
  it('returns the cached outcome on a fast Redis hit', async () => {
    const redis = fakeRedis();
    const step = new IdempotencyStep(redis as never);
    const command = makeCommand();
    const cached = { success: true, data: { ok: true } };
    redis.store.set(`idempotency:${tenantId.value}:${command.idempotencyKey}`, cached);

    await expect(step.fastLookup(command)).resolves.toEqual(cached);
  });

  it('returns undefined on a fast lookup miss', async () => {
    const redis = fakeRedis();
    const step = new IdempotencyStep(redis as never);

    await expect(step.fastLookup(makeCommand())).resolves.toBeUndefined();
  });

  it('reserves the idempotency key row as PENDING with the request hash and doNothing on conflict', async () => {
    const redis = fakeRedis();
    const step = new IdempotencyStep(redis as never);
    const { tx, insertValues } = fakeTx();
    const command = makeCommand();

    await step.reserveKey(tx as never, command);

    expect(insertValues).toHaveLength(1);
    expect(insertValues[0]).toMatchObject({
      tenant_id: tenantId.value,
      key: command.idempotencyKey,
      hash: 'hash-1',
      status: 'PENDING',
      command_name: command.commandName,
      aggregate_type: command.aggregateType,
    });
  });

  it('rejects when an existing idempotency key has a different request hash', async () => {
    const redis = fakeRedis();
    const step = new IdempotencyStep(redis as never);
    const { tx, setSelectResult } = fakeTx();
    setSelectResult({ hash: 'a-different-hash' });

    await expect(step.rejectHashMismatch(tx as never, makeCommand())).rejects.toMatchObject({
      errorCode: 'IDEMPOTENCY_HASH_MISMATCH',
    });
  });

  it('allows a retry with the same request hash to proceed', async () => {
    const redis = fakeRedis();
    const step = new IdempotencyStep(redis as never);
    const { tx, setSelectResult } = fakeTx();
    setSelectResult({ hash: 'hash-1' });

    await expect(step.rejectHashMismatch(tx as never, makeCommand())).resolves.toBeUndefined();
  });

  it('does not reject when no idempotency key row exists yet', async () => {
    const redis = fakeRedis();
    const step = new IdempotencyStep(redis as never);
    const { tx, setSelectResult } = fakeTx();
    setSelectResult(undefined);

    await expect(step.rejectHashMismatch(tx as never, makeCommand())).resolves.toBeUndefined();
  });

  it('marks the idempotency key SUCCESS and caches the result on success', async () => {
    const redis = fakeRedis();
    const step = new IdempotencyStep(redis as never);
    const { tx, updateSets, wheres } = fakeTx();
    const command = makeCommand();
    const result = { success: true, data: { done: true } };

    await step.storeResult(tx as never, command, result);

    expect(updateSets).toEqual([{ status: 'SUCCESS' }]);
    expect(wheres).toContainEqual(['tenant_id', '=', tenantId.value]);
    expect(wheres).toContainEqual(['key', '=', command.idempotencyKey]);
    expect(redis.set).toHaveBeenCalledWith(
      `idempotency:${tenantId.value}:${command.idempotencyKey}`,
      result,
      86400,
    );
  });

  it('marks the idempotency key FAILED and caches the error on failure', async () => {
    const redis = fakeRedis();
    const step = new IdempotencyStep(redis as never);
    const { tx, updateSets } = fakeTx();
    const command = makeCommand();
    const error = { success: false, errorCode: 'SOME_ERROR' };

    await step.storeError(tx as never, command, error as never);

    expect(updateSets).toEqual([{ status: 'FAILED' }]);
    expect(redis.set).toHaveBeenCalledWith(
      `idempotency:${tenantId.value}:${command.idempotencyKey}`,
      error,
      86400,
    );
  });
});
