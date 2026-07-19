import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictError, NotFoundError, Uuid } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { HrAiUseCase } from '../aggregates/hr-ai-use-case.aggregate.js';
import { HrAiKillSwitch } from '../aggregates/hr-ai-kill-switch.aggregate.js';
import type { HrAiUseCaseRepository } from '../repositories/hr-ai-use-case.repository.js';
import type { HrAiKillSwitchRepository } from '../repositories/hr-ai-kill-switch.repository.js';
import type { HrAiModelRunRepository } from '../repositories/hr-ai-model-run.repository.js';
import { HrAiUseCaseGuard } from '../services/hr-ai-use-case-guard.service.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrAiModelRunFsmRegistrar } from '../fsm/hr-ai-model-run.fsm.js';
import { HrAiGovernanceEventsPublisher } from '../events/hr-ai-governance-events.publisher.js';
import { CreateHrAiModelRunHandler, type CreateHrAiModelRunPayload } from './create-hr-ai-model-run.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const otherTenantId = new Uuid('00000000-0000-0000-0000-000000000002');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const useCaseId = new Uuid('00000000-0000-0000-0000-000000000100');
const modelRunId = new Uuid('00000000-0000-0000-0000-000000000200');
const killSwitchId = new Uuid('00000000-0000-0000-0000-000000000300');

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId,
    roles: ['AI_GOVERNANCE_ADMIN'],
    permissions: ['HR_AI_GOVERNANCE_WRITE'],
    email: 'ai.governance@example.com',
    mfaAuthenticated: true,
  };
}

function envelope(payload: CreateHrAiModelRunPayload, tenant: Uuid = tenantId): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'CreateHrAiModelRun',
    commandSchemaVersion: 1,
    tenantId: tenant,
    actor: actor(),
    aggregateType: 'HrAiModelRun',
    aggregateId: modelRunId,
    idempotencyKey: `CreateHrAiModelRun-${Date.now()}-${Math.random()}`,
    correlationId: Uuid.generate(),
    reason: 'spec',
    payload,
    metadata: { requestHash: 'test-hash', clientType: 'HR_ADMIN' },
  };
}

function makeUseCase(status: HrAiUseCase['status'], tenant: Uuid = tenantId): HrAiUseCase {
  return new HrAiUseCase({
    id: useCaseId,
    tenantId: tenant,
    useCaseName: 'Resume screening',
    useCaseType: 'CANDIDATE_SCREENING',
    riskClassification: 'HIGH',
    status,
  });
}

function makeKillSwitch(status: HrAiKillSwitch['status'], tenant: Uuid = tenantId): HrAiKillSwitch {
  return new HrAiKillSwitch({
    id: killSwitchId,
    tenantId: tenant,
    useCaseId,
    triggeredBy: actorId,
    triggerReason: 'observed disparate impact',
    status,
  });
}

/** Fake tenant-scoped use-case repo backed by a single mutable reference. */
function fakeUseCaseRepo(initial?: HrAiUseCase) {
  return {
    findById: vi.fn(async (id: Uuid, tenant: Uuid) => {
      if (!initial) return undefined;
      if (id.value !== initial.id.value || tenant.value !== initial.tenantId.value) return undefined;
      return initial;
    }),
    save: vi.fn(async () => {}),
  };
}

/** Fake tenant-scoped kill-switch repo backed by a fixed list. */
function fakeKillSwitchRepo(switches: HrAiKillSwitch[] = []) {
  return {
    findByUseCaseId: vi.fn(async (id: Uuid, tenant: Uuid) =>
      switches.filter((ks) => ks.useCaseId.value === id.value && ks.tenantId.value === tenant.value),
    ),
    findById: vi.fn(async () => undefined),
    findByTenant: vi.fn(async () => []),
    save: vi.fn(async () => {}),
  };
}

function fakeModelRunRepo() {
  let current: unknown;
  return {
    findById: vi.fn(async () => current),
    save: vi.fn(async (run: unknown) => {
      current = run;
    }),
    get current() {
      return current;
    },
  };
}

function makeFsm(): FsmFramework {
  const fsm = new FsmFramework();
  new HrAiModelRunFsmRegistrar(fsm).onModuleInit();
  return fsm;
}

describe('CreateHrAiModelRunHandler (kill-switch / suspension enforcement)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects creating a model run for a SUSPENDED use case', async () => {
    const useCaseRepo = fakeUseCaseRepo(makeUseCase('SUSPENDED'));
    const killSwitchRepo = fakeKillSwitchRepo([]);
    const modelRunRepo = fakeModelRunRepo();
    const guard = new HrAiUseCaseGuard(
      useCaseRepo as unknown as HrAiUseCaseRepository,
      killSwitchRepo as unknown as HrAiKillSwitchRepository,
    );
    const handler = new CreateHrAiModelRunHandler(
      modelRunRepo as unknown as HrAiModelRunRepository,
      makeFsm(),
      new HrAiGovernanceEventsPublisher(),
      guard,
    );

    const payload: CreateHrAiModelRunPayload = {
      hrAiModelRunId: modelRunId.value,
      useCaseId: useCaseId.value,
      modelVersion: 'v1',
    };

    await expect(handler.handle(envelope(payload))).rejects.toThrow(ConflictError);
    await expect(handler.handle(envelope(payload))).rejects.toThrow(/SUSPENDED/);
    expect(modelRunRepo.save).not.toHaveBeenCalled();
  });

  it('rejects creating a model run when the use case has a TRIGGERED kill switch', async () => {
    const useCaseRepo = fakeUseCaseRepo(makeUseCase('ACTIVE'));
    const killSwitchRepo = fakeKillSwitchRepo([makeKillSwitch('TRIGGERED')]);
    const modelRunRepo = fakeModelRunRepo();
    const guard = new HrAiUseCaseGuard(
      useCaseRepo as unknown as HrAiUseCaseRepository,
      killSwitchRepo as unknown as HrAiKillSwitchRepository,
    );
    const handler = new CreateHrAiModelRunHandler(
      modelRunRepo as unknown as HrAiModelRunRepository,
      makeFsm(),
      new HrAiGovernanceEventsPublisher(),
      guard,
    );

    const payload: CreateHrAiModelRunPayload = {
      hrAiModelRunId: modelRunId.value,
      useCaseId: useCaseId.value,
      modelVersion: 'v1',
    };

    await expect(handler.handle(envelope(payload))).rejects.toThrow(ConflictError);
    await expect(handler.handle(envelope(payload))).rejects.toThrow(/active kill switch/);
    expect(modelRunRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the use case does not exist for the calling tenant (cross-tenant lookup miss)', async () => {
    // Use case exists only under a different tenant than the command's -
    // the tenant-scoped findById must not leak it.
    const useCaseRepo = fakeUseCaseRepo(makeUseCase('ACTIVE', otherTenantId));
    const killSwitchRepo = fakeKillSwitchRepo([]);
    const modelRunRepo = fakeModelRunRepo();
    const guard = new HrAiUseCaseGuard(
      useCaseRepo as unknown as HrAiUseCaseRepository,
      killSwitchRepo as unknown as HrAiKillSwitchRepository,
    );
    const handler = new CreateHrAiModelRunHandler(
      modelRunRepo as unknown as HrAiModelRunRepository,
      makeFsm(),
      new HrAiGovernanceEventsPublisher(),
      guard,
    );

    const payload: CreateHrAiModelRunPayload = {
      hrAiModelRunId: modelRunId.value,
      useCaseId: useCaseId.value,
      modelVersion: 'v1',
    };

    await expect(handler.handle(envelope(payload, tenantId))).rejects.toThrow(NotFoundError);
    expect(modelRunRepo.save).not.toHaveBeenCalled();
  });

  it('happy path: an ACTIVE use case with no triggered kill switch still creates the run successfully', async () => {
    const useCaseRepo = fakeUseCaseRepo(makeUseCase('ACTIVE'));
    // A RESOLVED kill switch (past incident, closed) must not block.
    const killSwitchRepo = fakeKillSwitchRepo([makeKillSwitch('RESOLVED')]);
    const modelRunRepo = fakeModelRunRepo();
    const guard = new HrAiUseCaseGuard(
      useCaseRepo as unknown as HrAiUseCaseRepository,
      killSwitchRepo as unknown as HrAiKillSwitchRepository,
    );
    const handler = new CreateHrAiModelRunHandler(
      modelRunRepo as unknown as HrAiModelRunRepository,
      makeFsm(),
      new HrAiGovernanceEventsPublisher(),
      guard,
    );

    const payload: CreateHrAiModelRunPayload = {
      hrAiModelRunId: modelRunId.value,
      useCaseId: useCaseId.value,
      modelVersion: 'v1',
      inputDataSnapshot: { candidateCount: 42 },
    };

    const result = await handler.handle(envelope(payload));

    expect(result.success).toBe(true);
    expect(result.newState).toBe('PENDING');
    expect(modelRunRepo.save).toHaveBeenCalledTimes(1);
    expect(modelRunRepo.current).toMatchObject({ id: modelRunId, status: 'PENDING' });
  });
});
