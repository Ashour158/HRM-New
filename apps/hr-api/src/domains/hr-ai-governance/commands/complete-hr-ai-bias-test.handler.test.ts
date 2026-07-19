import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { HrAiBiasTest } from '../aggregates/hr-ai-bias-test.aggregate.js';
import type { HrAiBiasTestRepository } from '../repositories/hr-ai-bias-test.repository.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrAiBiasTestFsmRegistrar } from '../fsm/hr-ai-bias-test.fsm.js';
import { HrAiGovernanceEventsPublisher } from '../events/hr-ai-governance-events.publisher.js';
import { PlanHrAiBiasTestHandler } from './plan-hr-ai-bias-test.handler.js';
import { StartHrAiBiasTestHandler } from './start-hr-ai-bias-test.handler.js';
import { CompleteHrAiBiasTestHandler, type CompleteHrAiBiasTestPayload } from './complete-hr-ai-bias-test.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const useCaseId = new Uuid('00000000-0000-0000-0000-000000000100');
const biasTestId = new Uuid('00000000-0000-0000-0000-000000000300');

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

function envelope<T>(commandName: string, payload: T, aggregateId = biasTestId): HrCommandEnvelope<T> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: actor(),
    aggregateType: 'HrAiBiasTest',
    aggregateId,
    idempotencyKey: `${commandName}-${Date.now()}-${Math.random()}`,
    correlationId: Uuid.generate(),
    reason: 'spec',
    payload,
    metadata: { requestHash: 'test-hash', clientType: 'HR_ADMIN' },
  };
}

/** Builds an in-memory fake repo backed by a single mutable bias-test reference. */
function fakeBiasTestRepo(initial?: HrAiBiasTest) {
  let current = initial;
  return {
    findById: vi.fn(async () => current),
    save: vi.fn(async (bt: HrAiBiasTest) => {
      current = bt;
    }),
    get current() {
      return current;
    },
  };
}

function makeFsm(): FsmFramework {
  const fsm = new FsmFramework();
  new HrAiBiasTestFsmRegistrar(fsm).onModuleInit();
  return fsm;
}

describe('CompleteHrAiBiasTestHandler (real bias computation, not caller-supplied)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  async function planAndStart(repo: ReturnType<typeof fakeBiasTestRepo>, fsm: FsmFramework, publisher: HrAiGovernanceEventsPublisher) {
    const planHandler = new PlanHrAiBiasTestHandler(repo as unknown as HrAiBiasTestRepository, fsm, publisher);
    await planHandler.handle(envelope('PlanHrAiBiasTest', {
      hrAiBiasTestId: biasTestId.value,
      useCaseId: useCaseId.value,
      testType: 'ADVERSE_IMPACT',
    }));
    const startHandler = new StartHrAiBiasTestHandler(repo as unknown as HrAiBiasTestRepository, fsm, publisher);
    await startHandler.handle(envelope('StartHrAiBiasTest', { hrAiBiasTestId: biasTestId.value }));
  }

  it('computes PASSED from a fair outcome distribution — the handler never receives passed/metrics as input', async () => {
    const repo = fakeBiasTestRepo();
    const fsm = makeFsm();
    const publisher = new HrAiGovernanceEventsPublisher();
    await planAndStart(repo, fsm, publisher);

    const completeHandler = new CompleteHrAiBiasTestHandler(repo as unknown as HrAiBiasTestRepository, fsm, publisher);
    const payload: CompleteHrAiBiasTestPayload = {
      hrAiBiasTestId: biasTestId.value,
      outcomeData: [
        { group: 'group_a', selected: 48, totalConsidered: 100 },
        { group: 'group_b', selected: 45, totalConsidered: 100 },
      ],
    };
    // Note: CompleteHrAiBiasTestPayload has no `passed` or `metrics` field at
    // all — this is a compile-time guarantee the caller cannot assert a verdict.
    const result = await completeHandler.handle(envelope('CompleteHrAiBiasTest', payload));

    expect(result.success).toBe(true);
    expect(result.newState).toBe('COMPLETED');
    expect(repo.current?.passed).toBe(true);
    const metrics = repo.current?.metrics as { decisionCode: string; referenceGroup: string };
    expect(metrics.decisionCode).toBe('PASSED');
    expect(metrics.referenceGroup).toBe('group_a');
  });

  it('computes FAILED from a biased outcome distribution, independent of any caller assertion', async () => {
    const repo = fakeBiasTestRepo();
    const fsm = makeFsm();
    const publisher = new HrAiGovernanceEventsPublisher();
    await planAndStart(repo, fsm, publisher);

    const completeHandler = new CompleteHrAiBiasTestHandler(repo as unknown as HrAiBiasTestRepository, fsm, publisher);
    const payload: CompleteHrAiBiasTestPayload = {
      hrAiBiasTestId: biasTestId.value,
      outcomeData: [
        { group: 'group_a', selected: 80, totalConsidered: 100 },
        { group: 'group_b', selected: 30, totalConsidered: 100 },
      ],
    };
    const result = await completeHandler.handle(envelope('CompleteHrAiBiasTest', payload));

    expect(result.success).toBe(true);
    expect(repo.current?.passed).toBe(false);
    const metrics = repo.current?.metrics as { decisionCode: string };
    expect(metrics.decisionCode).toBe('FAILED');
  });

  it('cannot be completed twice (FSM guard) and rejects malformed outcome data (aggregate-level validation)', async () => {
    const repo = fakeBiasTestRepo();
    const fsm = makeFsm();
    const publisher = new HrAiGovernanceEventsPublisher();
    await planAndStart(repo, fsm, publisher);

    const completeHandler = new CompleteHrAiBiasTestHandler(repo as unknown as HrAiBiasTestRepository, fsm, publisher);
    const goodPayload: CompleteHrAiBiasTestPayload = {
      hrAiBiasTestId: biasTestId.value,
      outcomeData: [
        { group: 'group_a', selected: 10, totalConsidered: 20 },
        { group: 'group_b', selected: 9, totalConsidered: 20 },
      ],
    };
    await completeHandler.handle(envelope('CompleteHrAiBiasTest', goodPayload));

    await expect(
      completeHandler.handle(envelope('CompleteHrAiBiasTest', goodPayload)),
    ).rejects.toThrow(/Cannot complete from state COMPLETED/);

    // A fresh in-progress test rejects outcome data that fails basic invariants.
    const repo2 = fakeBiasTestRepo();
    await planAndStart(repo2, fsm, publisher);
    const completeHandler2 = new CompleteHrAiBiasTestHandler(repo2 as unknown as HrAiBiasTestRepository, fsm, publisher);
    const badPayload: CompleteHrAiBiasTestPayload = {
      hrAiBiasTestId: biasTestId.value,
      outcomeData: [{ group: 'group_a', selected: 999, totalConsidered: 10 }],
    };
    await expect(
      completeHandler2.handle(envelope('CompleteHrAiBiasTest', badPayload)),
    ).rejects.toThrow(ValidationError);
  });
});
