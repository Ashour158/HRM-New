import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AccessControlService } from '@hcm/access-control';
import { CommandBus } from './command-bus.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440001');

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
      permissions: ['WORKER_UPDATE'],
      mfaAuthenticated: true,
    },
    aggregateType: 'WorkerProfile',
    aggregateId: workerId,
    expectedState: 'ACTIVE',
    expectedVersion: 2,
    subjectWorkerId: workerId,
    idempotencyKey: 'idem-key',
    correlationId: new Uuid('550e8400-e29b-41d4-a716-446655440013'),
    reason: 'test',
    payload: { workerId },
    metadata: { requestHash: 'hash', clientType: 'EMPLOYEE_PORTAL' },
    ...overrides,
  };
}

function commandBusWith(overrides: Record<string, unknown> = {}) {
  return Object.assign(Object.create(CommandBus.prototype), {
    accessControl: new AccessControlService(),
    ...overrides,
  }) as Record<string, (...args: unknown[]) => Promise<unknown>>;
}

describe('CommandBus security gates', () => {
  it('rejects command actors whose actorId is not a UUID', async () => {
    const bus = commandBusWith();
    const command = makeCommand({
      actor: {
        actorType: 'SYSTEM',
        actorId: { value: 'system-api-key' } as never,
        roles: ['SYSTEM_ACTOR'],
        permissions: [],
        mfaAuthenticated: true,
      },
    });

    await expect(bus.stepAuthenticateActor(command)).rejects.toMatchObject({
      errorCode: 'UNAUTHENTICATED_ACTOR',
    });
  });

  it('does not skip FSM evaluation when an expected aggregate could not be loaded', async () => {
    const bus = commandBusWith();

    await expect(bus.stepEvaluateFsm(makeCommand(), undefined)).rejects.toMatchObject({
      errorCode: 'AGGREGATE_NOT_LOADED',
    });
  });

  it('loads stateful aggregates from the declared table registry beyond the worker/payroll slice', async () => {
    const selectedTables: string[] = [];
    const executeTakeFirst = async () => ({
      id: workerId.value,
      status: 'NEW',
      aggregate_version: 3,
    });
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst,
    };
    const tx = {
      selectFrom: (table: string) => {
        selectedTables.push(table);
        return query;
      },
    };
    const bus = commandBusWith();

    const aggregate = await bus.stepLoadAggregate(tx, makeCommand({
      aggregateType: 'Candidate',
      expectedState: 'NEW',
      expectedVersion: 3,
    }));

    expect(selectedTables).toEqual(['hr_recruiting.candidates']);
    expect(aggregate).toMatchObject({ version: 3 });
  });

  it('rejects stale expected state when the stored aggregate state has moved', async () => {
    const executeTakeFirst = async () => ({
      id: workerId.value,
      status: 'SCREENING',
      aggregate_version: 3,
    });
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst,
    };
    const tx = {
      selectFrom: () => query,
    };
    const bus = commandBusWith();

    await expect(bus.stepLoadAggregate(tx, makeCommand({
      aggregateType: 'Candidate',
      expectedState: 'NEW',
      expectedVersion: 3,
    }))).rejects.toMatchObject({
      errorCode: 'AGGREGATE_STATE_CONFLICT',
    });
  });

  it('blocks employee mutation of payroll-sensitive fields at the command field policy gate', async () => {
    const bus = commandBusWith();
    const command = makeCommand({
      payload: {
        workerId,
        compensation: {
          grossSalaryAmount: 25_000,
          bankAccount: { iban: 'EG380019000500000000263180002' },
        },
      },
    });

    await expect(bus.stepEvaluateFieldPolicy(command)).rejects.toMatchObject({
      errorCode: 'FIELD_POLICY_DENIED',
    });
  });

  it('blocks worker mutations while the subject worker has an active legal hold', async () => {
    const executeTakeFirst = async () => ({ id: workerId.value, legal_hold_status: 'ACTIVE' });
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst,
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
    });

    await expect(bus.stepEvaluateLegalAndPolicy(makeCommand())).rejects.toMatchObject({
      errorCode: 'LEGAL_HOLD_BLOCKED',
    });
  });
});
