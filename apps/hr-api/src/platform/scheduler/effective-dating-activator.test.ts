import { describe, expect, it, vi } from 'vitest';
import { getCurrentTenantId } from '@hcm/platform-core';
import { Uuid } from '@hcm/shared-kernel';
import type { CommandBus } from '../command-bus/command-bus.js';
import { EffectiveDatingActivator } from './effective-dating-activator.js';
import type {
  EffectiveDatingActivationLogRepositoryPort,
  EffectiveDatingActivationLogStartInput,
} from './effective-dating-activation-log.repository.js';
import { SystemActorFactory } from './system-actor.factory.js';

const tenantId = new Uuid('00000000-0000-4000-8000-000000001111');
const duePolicyId = new Uuid('00000000-0000-4000-8000-000000002222');
const futurePolicyId = new Uuid('00000000-0000-4000-8000-000000003333');
const activePolicyId = new Uuid('00000000-0000-4000-8000-000000004444');

describe('EffectiveDatingActivator', () => {
  it('dispatches activation commands only for due pending rows', async () => {
    const commandContexts: string[] = [];
    const commandBus = {
      execute: vi.fn(async () => {
        commandContexts.push(getCurrentTenantId()?.value ?? 'missing');
        return { success: true };
      }),
    } as unknown as CommandBus;
    const logRepository = new FakeEffectiveDatingActivationLogRepository();
    const activator = new EffectiveDatingActivator(commandBus, logRepository, new SystemActorFactory());

    const result = await activator.activateDue({
      tenantId,
      jobName: 'policy-effective-dating',
      today: new Date('2026-06-13T10:00:00.000Z'),
      queryDueRows: async () => [
        { id: duePolicyId, aggregateType: 'PolicyRevision', status: 'PENDING', effectiveFrom: new Date('2026-06-13T00:00:00.000Z'), aggregateVersion: 4 },
        { id: futurePolicyId, aggregateType: 'PolicyRevision', status: 'PENDING', effectiveFrom: new Date('2026-06-14T00:00:00.000Z'), aggregateVersion: 1 },
        { id: activePolicyId, aggregateType: 'PolicyRevision', status: 'ACTIVE', effectiveFrom: new Date('2026-06-01T00:00:00.000Z'), aggregateVersion: 2 },
      ],
      buildCommand: (row) => ({
        commandName: 'ApplyPolicyRevision',
        aggregateType: row.aggregateType,
        aggregateId: row.id,
        expectedState: row.status,
        expectedVersion: row.aggregateVersion,
        payload: { revisionId: row.id.value },
      }),
    });

    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(2);
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandContexts).toEqual([tenantId.value]);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'ApplyPolicyRevision',
      aggregateId: duePolicyId,
      expectedState: 'PENDING',
      expectedVersion: 4,
      idempotencyKey: `effective-dating:${tenantId.value}:policy-effective-dating:PolicyRevision:${duePolicyId.value}:2026-06-13`,
      actor: expect.objectContaining({
        actorType: 'SYSTEM',
        roles: ['SYSTEM_ACTOR'],
      }),
      metadata: expect.objectContaining({ clientType: 'SYSTEM_SCHEDULER' }),
    }));
  });

  it('does not redispatch the same activation row across re-runs', async () => {
    const commandBus = {
      execute: vi.fn(async () => ({ success: true })),
    } as unknown as CommandBus;
    const logRepository = new FakeEffectiveDatingActivationLogRepository();
    const activator = new EffectiveDatingActivator(commandBus, logRepository, new SystemActorFactory());
    const input = {
      tenantId,
      jobName: 'benefits-effective-dating',
      today: new Date('2026-06-13T10:00:00.000Z'),
      queryDueRows: async () => [
        { id: duePolicyId, aggregateType: 'BenefitsEnrollment', status: 'SCHEDULED', effectiveFrom: new Date('2026-06-01T00:00:00.000Z') },
      ],
      buildCommand: (row: { id: Uuid; aggregateType: string; status: string }) => ({
        commandName: 'MakeEffectiveBenefitsEnrollment',
        aggregateType: row.aggregateType,
        aggregateId: row.id,
        expectedState: row.status,
        payload: { enrollmentId: row.id.value },
      }),
    };

    const first = await activator.activateDue(input);
    const second = await activator.activateDue(input);

    expect(first.processed).toBe(1);
    expect(second.processed).toBe(0);
    expect(second.skipped).toBe(1);
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
  });

  it('honors custom due statuses for effective-dated close jobs', async () => {
    const commandBus = {
      execute: vi.fn(async () => ({ success: true })),
    } as unknown as CommandBus;
    const logRepository = new FakeEffectiveDatingActivationLogRepository();
    const activator = new EffectiveDatingActivator(commandBus, logRepository, new SystemActorFactory());

    const result = await activator.activateDue({
      tenantId,
      jobName: 'recognition-program-period-close',
      today: new Date('2026-06-13T10:00:00.000Z'),
      dueStatuses: ['ACTIVE'],
      queryDueRows: async () => [
        { id: duePolicyId, aggregateType: 'RecognitionProgram', status: 'ACTIVE', effectiveFrom: new Date('2026-06-01T00:00:00.000Z') },
      ],
      buildCommand: (row) => ({
        commandName: 'CloseRecognitionProgram',
        aggregateType: row.aggregateType,
        aggregateId: row.id,
        expectedState: row.status,
        payload: { recognitionProgramId: row.id.value },
      }),
    });

    expect(result.processed).toBe(1);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CloseRecognitionProgram',
      expectedState: 'ACTIVE',
    }));
  });
});

class FakeEffectiveDatingActivationLogRepository implements EffectiveDatingActivationLogRepositoryPort {
  private readonly records = new Map<string, 'RUNNING' | 'SUCCEEDED' | 'FAILED'>();

  async tryStartActivation(input: EffectiveDatingActivationLogStartInput) {
    const key = activationKey(input);
    const existing = this.records.get(key);
    if (existing === 'SUCCEEDED' || existing === 'RUNNING') {
      return { started: false as const, status: existing };
    }
    this.records.set(key, 'RUNNING');
    return { started: true as const, activationId: Uuid.generate() };
  }

  async markSucceeded(input: { activationId: Uuid }) {
    for (const [key, status] of this.records.entries()) {
      if (status === 'RUNNING') {
        this.records.set(key, 'SUCCEEDED');
        break;
      }
    }
    void input;
  }

  async markFailed(input: { activationId: Uuid; error: string }) {
    for (const [key, status] of this.records.entries()) {
      if (status === 'RUNNING') {
        this.records.set(key, 'FAILED');
        break;
      }
    }
    void input;
  }
}

function activationKey(input: EffectiveDatingActivationLogStartInput): string {
  return [
    input.tenantId.value,
    input.jobName,
    input.aggregateType,
    input.aggregateId.value,
    input.effectiveDateBucket,
  ].join('|');
}
