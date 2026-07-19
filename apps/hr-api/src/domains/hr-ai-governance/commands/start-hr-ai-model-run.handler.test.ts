import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictError, Uuid } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { HrAiModelRun } from '../aggregates/hr-ai-model-run.aggregate.js';
import { HrAiUseCase } from '../aggregates/hr-ai-use-case.aggregate.js';
import { HrAiKillSwitch } from '../aggregates/hr-ai-kill-switch.aggregate.js';
import type { HrAiUseCaseRepository } from '../repositories/hr-ai-use-case.repository.js';
import type { HrAiKillSwitchRepository } from '../repositories/hr-ai-kill-switch.repository.js';
import type { HrAiModelRunRepository } from '../repositories/hr-ai-model-run.repository.js';
import { HrAiUseCaseGuard } from '../services/hr-ai-use-case-guard.service.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrAiModelRunFsmRegistrar } from '../fsm/hr-ai-model-run.fsm.js';
import { HrAiGovernanceEventsPublisher } from '../events/hr-ai-governance-events.publisher.js';
import { StartHrAiModelRunHandler, type StartHrAiModelRunPayload } from './start-hr-ai-model-run.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
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

function envelope(payload: StartHrAiModelRunPayload): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'StartHrAiModelRun',
    commandSchemaVersion: 1,
    tenantId,
    actor: actor(),
    aggregateType: 'HrAiModelRun',
    aggregateId: modelRunId,
    idempotencyKey: `StartHrAiModelRun-${Date.now()}-${Math.random()}`,
    correlationId: Uuid.generate(),
    reason: 'spec',
    payload,
    metadata: { requestHash: 'test-hash', clientType: 'HR_ADMIN' },
  };
}

function makePendingRun(): HrAiModelRun {
  return HrAiModelRun.create(
    { id: modelRunId, tenantId, useCaseId, modelVersion: 'v1' },
    Uuid.generate(),
  );
}

function makeUseCase(status: HrAiUseCase['status']): HrAiUseCase {
  return new HrAiUseCase({
    id: useCaseId,
    tenantId,
    useCaseName: 'Resume screening',
    useCaseType: 'CANDIDATE_SCREENING',
    riskClassification: 'HIGH',
    status,
  });
}

function makeKillSwitch(status: HrAiKillSwitch['status']): HrAiKillSwitch {
  return new HrAiKillSwitch({
    id: killSwitchId,
    tenantId,
    useCaseId,
    triggeredBy: actorId,
    triggerReason: 'observed disparate impact',
    status,
  });
}

function fakeModelRunRepo(initial: HrAiModelRun) {
  let current: HrAiModelRun = initial;
  return {
    findById: vi.fn(async () => current),
    save: vi.fn(async (run: HrAiModelRun) => {
      current = run;
    }),
    get current() {
      return current;
    },
  };
}

function fakeUseCaseRepo(initial: HrAiUseCase) {
  return {
    findById: vi.fn(async () => initial),
    save: vi.fn(async () => {}),
  };
}

function fakeKillSwitchRepo(switches: HrAiKillSwitch[] = []) {
  return {
    findByUseCaseId: vi.fn(async () => switches),
    findById: vi.fn(async () => undefined),
    findByTenant: vi.fn(async () => []),
    save: vi.fn(async () => {}),
  };
}

function makeFsm(): FsmFramework {
  const fsm = new FsmFramework();
  new HrAiModelRunFsmRegistrar(fsm).onModuleInit();
  return fsm;
}

describe('StartHrAiModelRunHandler (kill-switch / suspension enforcement)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects starting a model run whose use case has since been SUSPENDED', async () => {
    const modelRunRepo = fakeModelRunRepo(makePendingRun());
    const useCaseRepo = fakeUseCaseRepo(makeUseCase('SUSPENDED'));
    const killSwitchRepo = fakeKillSwitchRepo([]);
    const guard = new HrAiUseCaseGuard(
      useCaseRepo as unknown as HrAiUseCaseRepository,
      killSwitchRepo as unknown as HrAiKillSwitchRepository,
    );
    const handler = new StartHrAiModelRunHandler(
      modelRunRepo as unknown as HrAiModelRunRepository,
      makeFsm(),
      new HrAiGovernanceEventsPublisher(),
      guard,
    );

    await expect(
      handler.handle(envelope({ hrAiModelRunId: modelRunId.value })),
    ).rejects.toThrow(ConflictError);
    // The run must remain PENDING, not silently flip to RUNNING.
    expect(modelRunRepo.current.status).toBe('PENDING');
  });

  it('rejects starting a model run whose use case has a TRIGGERED kill switch', async () => {
    const modelRunRepo = fakeModelRunRepo(makePendingRun());
    const useCaseRepo = fakeUseCaseRepo(makeUseCase('ACTIVE'));
    const killSwitchRepo = fakeKillSwitchRepo([makeKillSwitch('TRIGGERED')]);
    const guard = new HrAiUseCaseGuard(
      useCaseRepo as unknown as HrAiUseCaseRepository,
      killSwitchRepo as unknown as HrAiKillSwitchRepository,
    );
    const handler = new StartHrAiModelRunHandler(
      modelRunRepo as unknown as HrAiModelRunRepository,
      makeFsm(),
      new HrAiGovernanceEventsPublisher(),
      guard,
    );

    await expect(
      handler.handle(envelope({ hrAiModelRunId: modelRunId.value })),
    ).rejects.toThrow(/active kill switch/);
    expect(modelRunRepo.current.status).toBe('PENDING');
  });

  it('also rejects while the kill switch is INVESTIGATING (not yet resolved)', async () => {
    const modelRunRepo = fakeModelRunRepo(makePendingRun());
    const useCaseRepo = fakeUseCaseRepo(makeUseCase('ACTIVE'));
    const killSwitchRepo = fakeKillSwitchRepo([makeKillSwitch('INVESTIGATING')]);
    const guard = new HrAiUseCaseGuard(
      useCaseRepo as unknown as HrAiUseCaseRepository,
      killSwitchRepo as unknown as HrAiKillSwitchRepository,
    );
    const handler = new StartHrAiModelRunHandler(
      modelRunRepo as unknown as HrAiModelRunRepository,
      makeFsm(),
      new HrAiGovernanceEventsPublisher(),
      guard,
    );

    await expect(
      handler.handle(envelope({ hrAiModelRunId: modelRunId.value })),
    ).rejects.toThrow(ConflictError);
    expect(modelRunRepo.current.status).toBe('PENDING');
  });

  it('happy path: an ACTIVE use case with an ARMED kill switch still starts the run successfully', async () => {
    const modelRunRepo = fakeModelRunRepo(makePendingRun());
    const useCaseRepo = fakeUseCaseRepo(makeUseCase('ACTIVE'));
    const killSwitchRepo = fakeKillSwitchRepo([makeKillSwitch('ARMED')]);
    const guard = new HrAiUseCaseGuard(
      useCaseRepo as unknown as HrAiUseCaseRepository,
      killSwitchRepo as unknown as HrAiKillSwitchRepository,
    );
    const handler = new StartHrAiModelRunHandler(
      modelRunRepo as unknown as HrAiModelRunRepository,
      makeFsm(),
      new HrAiGovernanceEventsPublisher(),
      guard,
    );

    const result = await handler.handle(envelope({ hrAiModelRunId: modelRunId.value }));

    expect(result.success).toBe(true);
    expect(result.newState).toBe('RUNNING');
    expect(modelRunRepo.current.status).toBe('RUNNING');
    expect(modelRunRepo.save).toHaveBeenCalledTimes(1);
  });
});
