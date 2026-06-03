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

  it('normalizes aggregate versions from database rows before FSM conflict checks', async () => {
    const bus = commandBusWith({
      fsmFramework: {
        getAllowedActions: () => ['UpdateWorkerPersonalData'],
      },
    });

    await expect(bus.stepEvaluateFsm(makeCommand({
      expectedState: 'ACTIVE',
      expectedVersion: 1,
    }), { version: '1' } as never)).resolves.toBeUndefined();
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

  it('writes handler-emitted canonical event names to the outbox', async () => {
    const inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
    const tx = {
      insertInto: (table: string) => ({
        values: (row: Record<string, unknown>) => ({
          execute: async () => {
            inserted.push({ table, row });
          },
        }),
      }),
    };
    const bus = commandBusWith();

    await bus.stepWriteOutbox(tx, makeCommand({
      commandName: 'SuspendWorker',
      aggregateType: 'WorkerProfile',
    }), {
      success: true,
      data: { workerId: workerId.value, status: 'SUSPENDED' },
      commandId: new Uuid('550e8400-e29b-41d4-a716-446655440011'),
      correlationId: new Uuid('550e8400-e29b-41d4-a716-446655440013'),
      aggregateId: workerId,
      newState: 'SUSPENDED',
      newVersion: 3,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: ['WorkerSuspended'],
      auditRecordId: new Uuid('550e8400-e29b-41d4-a716-446655440014'),
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      table: 'outbox_events',
      row: { event_name: 'WorkerSuspended' },
    });
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

  it('blocks direct command execution when an applied access policy hides the action', async () => {
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst: async () => ({
        config: {
          policyGovernance: {
            allowedActionOverrides: [{
              id: 'deny-worker-update',
              active: true,
              aggregateType: 'WorkerProfile',
              action: 'UpdateWorkerPersonalData',
              roles: ['HR_ADMIN'],
              effect: 'HIDE',
              reason: 'Employees cannot update this worker section during policy freeze.',
            }],
            fieldAccessOverrides: [],
          },
        },
      }),
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
    });

    const command = makeCommand({
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440017'),
        roles: ['HR_ADMIN'],
        permissions: ['WORKER_UPDATE'],
        mfaAuthenticated: true,
      },
    });

    await expect(bus.stepEvaluateRbac(command)).resolves.toBeUndefined();
    await expect(bus.stepEvaluateRuntimeAccessGovernance(command)).rejects.toMatchObject({
      errorCode: 'RUNTIME_POLICY_ACTION_DENIED',
    });
  });

  it('blocks direct command execution when an applied field policy denies a payload field', async () => {
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst: async () => ({
        config: {
          policyGovernance: {
            allowedActionOverrides: [],
            fieldAccessOverrides: [{
              id: 'deny-bank-account',
              active: true,
              resourceType: 'WorkerProfile',
              fieldPath: 'homeAddress.line1',
              roles: ['EMPLOYEE'],
              decision: 'DENIED',
              reason: 'Home address changes require administrator review.',
            }],
          },
        },
      }),
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
    });

    const command = makeCommand({
      payload: {
        workerId,
        homeAddress: {
          line1: '12 Nile Street',
        },
      },
    });

    await expect(bus.stepEvaluateFieldPolicy(command)).resolves.toBeUndefined();
    await expect(bus.stepEvaluateRuntimeAccessGovernance(command)).rejects.toMatchObject({
      errorCode: 'RUNTIME_POLICY_FIELD_DENIED',
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

  it('hydrates self-service employment status using the command tenant', async () => {
    const conditions: Array<[string, string, string]> = [];
    const query = {
      select: () => query,
      where: (field: string, operator: string, value: string) => {
        conditions.push([field, operator, value]);
        return query;
      },
      executeTakeFirst: async () => ({ status: 'ACTIVE' }),
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
    });

    const status = await bus.resolveActorEmploymentStatus(makeCommand(), 'EMPLOYEE');

    expect(status).toBe('ACTIVE');
    expect(conditions).toContainEqual(['tenant_id', '=', tenantId.value]);
  });

  it('validates manager subject access inside the command tenant', async () => {
    const conditions: Array<[string, string, string]> = [];
    const managerId = new Uuid('550e8400-e29b-41d4-a716-446655440015');
    const query = {
      select: () => query,
      where: (field: string, operator: string, value: string) => {
        conditions.push([field, operator, value]);
        return query;
      },
      executeTakeFirst: async () => ({ id: workerId.value }),
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
    });

    await bus.stepValidateSubjectWorkerAccess(makeCommand({
      actor: {
        actorType: 'USER',
        actorId: managerId,
        roles: ['MANAGER'],
        permissions: ['WORKER_UPDATE'],
        mfaAuthenticated: true,
      },
      subjectWorkerId: workerId,
    }));

    expect(conditions).toContainEqual(['tenant_id', '=', tenantId.value]);
  });

  it('maps workforce planning users to administrative command access for WFM mutations', async () => {
    const bus = commandBusWith();

    await expect(bus.stepEvaluateRbac(makeCommand({
      commandName: 'CreateShiftSchedule',
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440016'),
        roles: ['WORKFORCE_PLANNING_ADMIN'],
        permissions: [],
        mfaAuthenticated: true,
      },
      aggregateType: 'ShiftSchedule',
      aggregateId: undefined,
      expectedState: undefined,
      expectedVersion: undefined,
      payload: {},
    }))).resolves.toBeUndefined();
  });

  it('blocks statically allowed commands when applied allowed-action overrides hide the command action', async () => {
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst: async () => ({ status: 'ACTIVE' }),
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
      hcmSetup: {
        getSetup: async () => ({
          policyGovernance: {
            allowedActionOverrides: [
              {
                id: 'deny-submit-absence',
                active: true,
                aggregateType: 'AbsenceRequest',
                action: 'SubmitAbsenceRequest',
                roles: ['HR_ADMIN'],
                effect: 'HIDE',
                reason: 'Leave submissions are temporarily paused.',
              },
            ],
            fieldAccessOverrides: [],
          },
        }),
      },
    });

    const command = makeCommand({
      commandName: 'SubmitAbsenceRequest',
      aggregateType: 'AbsenceRequest',
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440018'),
        roles: ['HR_ADMIN'],
        permissions: ['ABSENCE_ADMIN'],
        mfaAuthenticated: true,
      },
      payload: { workerId },
    });

    await expect(bus.stepEvaluateRbac(command)).resolves.toBeUndefined();
    await expect(bus.stepEvaluateRuntimeAccessGovernance(command)).rejects.toMatchObject({
      errorCode: 'RUNTIME_POLICY_ACTION_DENIED',
    });
  });

  it('blocks command payload writes when applied field-access overrides deny the written field', async () => {
    const bus = commandBusWith({
      hcmSetup: {
        getSetup: async () => ({
          policyGovernance: {
            allowedActionOverrides: [],
            fieldAccessOverrides: [
              {
                id: 'deny-hr-home-address',
                active: true,
                resourceType: 'WorkerProfile',
                fieldPath: 'homeAddress.line1',
                roles: ['HR_ADMIN'],
                decision: 'DENIED',
                reason: 'Address updates are locked during audit.',
              },
            ],
          },
        }),
      },
    });

    const command = makeCommand({
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440017'),
        roles: ['HR_ADMIN'],
        permissions: ['WORKER_UPDATE'],
        mfaAuthenticated: true,
      },
      payload: {
        workerId,
        homeAddress: {
          line1: '12 Nile Street',
        },
      },
    });

    await expect(bus.stepEvaluateFieldPolicy(command)).resolves.toBeUndefined();
    await expect(bus.stepEvaluateRuntimeAccessGovernance(command)).rejects.toMatchObject({
      errorCode: 'RUNTIME_POLICY_FIELD_DENIED',
    });
  });

  it('enforces the self-service policy engine before executing employee commands', async () => {
    const bus = commandBusWith();

    await expect(bus.stepEvaluatePolicyEngine(makeCommand({
      commandName: 'ApprovePayrollCycle',
      aggregateType: 'PayrollCycle',
      payload: { workerId },
      metadata: { requestHash: 'hash', clientType: 'EMPLOYEE_PORTAL' },
    }))).rejects.toMatchObject({
      errorCode: 'POLICY_ENGINE_DENIED',
    });
  });

  it('stores event privacy evidence in outbox metadata for notification targeting', async () => {
    const inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
    const tx = {
      insertInto: (table: string) => ({
        values: (row: Record<string, unknown>) => ({
          execute: async () => {
            inserted.push({ table, row });
          },
        }),
      }),
    };
    const bus = commandBusWith();

    await bus.stepWriteOutbox(tx, makeCommand({
      subjectWorkerId: undefined,
      payload: { workerId },
      metadata: { requestHash: 'hash', clientType: 'EMPLOYEE_PORTAL', hrDataSensitivity: 'LOW' },
    }), {
      success: true,
      data: { workerId: workerId.value, status: 'SUBMITTED' },
      commandId: new Uuid('550e8400-e29b-41d4-a716-446655440011'),
      correlationId: new Uuid('550e8400-e29b-41d4-a716-446655440013'),
      aggregateId: workerId,
      newState: 'SUBMITTED',
      newVersion: 3,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: ['AbsenceRequestSubmitted'],
      auditRecordId: new Uuid('550e8400-e29b-41d4-a716-446655440014'),
    });

    expect(inserted[0]?.row.metadata).toMatchObject({
      privacy: {
        piiClassification: 'LOW',
        subjectWorkerId: workerId.value,
      },
    });
  });
});
