import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { CommandResult, HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { registerFeedback360CycleFsm } from '../fsm/feedback-360-cycle.fsm.js';
import { registerFeedback360ResponseFsm } from '../fsm/feedback-360-response.fsm.js';
import { CreateFeedback360CycleHandler } from './create-feedback-360-cycle.handler.js';
import { ActivateFeedback360CycleHandler } from './activate-feedback-360-cycle.handler.js';
import { LaunchFeedback360CycleHandler } from './launch-feedback-360-cycle.handler.js';
import { CreateFeedback360ResponseHandler } from './create-feedback-360-response.handler.js';
import { SubmitFeedback360ResponseHandler } from './submit-feedback-360-response.handler.js';
import { PerformanceAnalyticsService } from '../services/performance-analytics.service.js';

class MemoryRepo<T extends { id: Uuid; tenantId?: Uuid }> {
  readonly rows = new Map<string, T>();

  async save(entity: T): Promise<void> {
    this.rows.set(entity.id.value, entity);
  }

  async findById(id: Uuid): Promise<T | undefined> {
    return this.rows.get(id.value);
  }
}

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const revieweeId = new Uuid('00000000-0000-0000-0000-000000000020');
const reviewerId = new Uuid('00000000-0000-0000-0000-000000000021');

const actor: HrActor = {
  actorType: 'USER',
  actorId,
  roles: ['HR_ADMIN'],
  permissions: ['PERFORMANCE_CREATE', 'PERFORMANCE_WRITE', 'PERFORMANCE_READ'],
  email: 'hr.admin@example.com',
  mfaAuthenticated: true,
};

function command<TPayload>(commandName: string, aggregateType: string, payload: TPayload): HrCommandEnvelope<TPayload> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor,
    aggregateType,
    idempotencyKey: Uuid.generate().value,
    correlationId: Uuid.generate(),
    reason: 'test',
    payload,
    metadata: {
      requestHash: 'test',
      clientType: 'HR_ADMIN',
    },
  };
}

describe('Feedback 360 command flow', () => {
  it('creates, activates, launches, submits, and feeds analytics with canonical FSM actions', async () => {
    const fsm = new FsmFramework();
    registerFeedback360CycleFsm(fsm);
    registerFeedback360ResponseFsm(fsm);

    const cycleRepo = new MemoryRepo();
    const responseRepo = new MemoryRepo();
    const publisher = { publishFromAggregate: vi.fn().mockResolvedValue(undefined) };

    const createCycle = new CreateFeedback360CycleHandler(cycleRepo as never, fsm, publisher as never);
    const activateCycle = new ActivateFeedback360CycleHandler(cycleRepo as never, fsm, publisher as never);
    const launchCycle = new LaunchFeedback360CycleHandler(cycleRepo as never, fsm, publisher as never);
    const createResponse = new CreateFeedback360ResponseHandler(responseRepo as never, fsm, publisher as never);
    const submitResponse = new SubmitFeedback360ResponseHandler(responseRepo as never, fsm, publisher as never);

    const cycleResult = await createCycle.handle(command('CreatePerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', {
      name: 'FY26 360',
      cycleYear: 2026,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      minPeerReviews: 1,
    })) as CommandResult<{ feedback360CycleId: string; status: string }>;

    await activateCycle.handle(command('ActivatePerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', {
      feedback360CycleId: cycleResult.data.feedback360CycleId,
    }));
    await launchCycle.handle(command('LaunchPerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', {
      feedback360CycleId: cycleResult.data.feedback360CycleId,
    }));

    const responseResult = await createResponse.handle(command('CreatePerformanceFeedback360Response', 'PerformanceFeedback360Response', {
      cycleId: cycleResult.data.feedback360CycleId,
      revieweeId: revieweeId.value,
      reviewerId: reviewerId.value,
      relationshipType: 'PEER',
      isAnonymous: false,
    })) as CommandResult<{ feedback360ResponseId: string; status: string }>;

    expect(responseResult.allowedNextActions).toContain('SubmitPerformanceFeedback360Response');

    const submitResult = await submitResponse.handle(command('SubmitPerformanceFeedback360Response', 'PerformanceFeedback360Response', {
      feedback360ResponseId: responseResult.data.feedback360ResponseId,
      competencyScores: { communication: 4, professionalism: 5 },
      dimensionScores: { communication: 4, professionalism: 5, ethics: 5 },
      areaComments: { communication: 'Clear updates', professionalism: 'Reliable delivery' },
      overallRating: 4.5,
      strengths: 'Trusted and thoughtful',
      improvements: 'Share risks earlier',
      comments: 'Strong collaborator',
      isAnonymous: false,
    })) as CommandResult<{ feedback360ResponseId: string; status: string }>;

    expect(submitResult.newState).toBe('SUBMITTED');

    const analytics = new PerformanceAnalyticsService().buildCycleAnalytics({
      cycleId: cycleResult.data.feedback360CycleId,
      anonymityThreshold: 1,
      workers: [{ id: revieweeId.value, firstName: 'Amina', lastName: 'Nour' }],
      reviews: [],
      goals: [],
      objectives: [],
      keyResults: [],
      feedbackResponses: Array.from(responseRepo.rows.values()) as never,
      developmentPlans: [],
    });

    expect(analytics.feedbackSummaries[revieweeId.value]).toEqual(expect.objectContaining({
      averageRating: 4.5,
      conciseFeedback: expect.stringContaining('Trusted and thoughtful'),
    }));
  });
});
