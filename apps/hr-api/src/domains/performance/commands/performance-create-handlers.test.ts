import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { CreateCalibrationSessionHandler } from './create-calibration-session.handler.js';
import { CreateGoalHandler } from './create-goal.handler.js';
import { CreatePerformanceImprovementPlanHandler } from './create-performance-improvement-plan.handler.js';
import { CreatePerformanceReviewHandler } from './create-performance-review.handler.js';
import { PerformanceGoalPolicyService } from '../services/performance-goal-policy.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const workerId = '00000000-0000-0000-0000-000000000010';
const managerId = '00000000-0000-0000-0000-000000000011';
const reviewCycleId = '00000000-0000-0000-0000-000000000012';

function command<TPayload>(
  commandName: string,
  aggregateType: string,
  payload: TPayload,
): HrCommandEnvelope<TPayload> {
  const actor: HrActor = {
    actorType: 'USER',
    actorId,
    roles: ['HR_ADMIN'],
    permissions: ['PERFORMANCE_CREATE'],
    email: 'hr.admin@example.com',
    mfaAuthenticated: true,
  };

  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor,
    aggregateType,
    idempotencyKey: `${commandName}-${Uuid.generate().value}`,
    correlationId: Uuid.generate(),
    reason: 'test',
    payload,
    metadata: {
      requestHash: 'test',
      clientType: 'HR_ADMIN',
      hrDataSensitivity: 'HIGH',
    },
  };
}

function repoSpy() {
  return {
    saved: undefined as unknown,
    save: vi.fn(async function save(this: { saved: unknown }, aggregate: unknown) {
      this.saved = aggregate;
    }),
  };
}

const fsm = {
  getAllowedActionsFromState: vi.fn(() => []),
};

const publisher = {
  publishFromAggregate: vi.fn(async () => undefined),
};

describe('performance create handlers', () => {
  it('normalizes string worker ids before creating goals', async () => {
    const repo = repoSpy();
    const handler = new CreateGoalHandler(
      repo as never,
      fsm as never,
      publisher as never,
      new PerformanceGoalPolicyService(),
    );

    await handler.handle(command('CreateGoal', 'Goal', {
      workerId,
      title: 'Improve customer success quality',
      description: 'Raise quality and consistency for the success team.',
      targetValue: 90,
      unit: '%',
      dueDate: new Date('2026-12-31'),
      metricName: 'Quality score',
      smartCriteria: {
        specific: 'Improve customer success quality',
        measurable: 'Quality score reaches 90 percent',
        achievable: 'Uses current coaching capacity',
        relevant: 'Supports retention and customer experience',
        timeBound: 'Complete by end of 2026',
      },
    }));

    expect((repo.saved as { workerId: Uuid }).workerId).toBeInstanceOf(Uuid);
    expect((repo.saved as { workerId: Uuid }).workerId.value).toBe(workerId);
  });

  it('normalizes string ids before creating performance reviews', async () => {
    const repo = repoSpy();
    const handler = new CreatePerformanceReviewHandler(repo as never, fsm as never, publisher as never);

    await handler.handle(command('CreatePerformanceReview', 'PerformanceReview', {
      workerId,
      reviewCycleId,
      managerId,
    }));

    const saved = repo.saved as { workerId: Uuid; reviewCycleId: Uuid; managerId: Uuid };
    expect(saved.workerId).toBeInstanceOf(Uuid);
    expect(saved.reviewCycleId).toBeInstanceOf(Uuid);
    expect(saved.managerId).toBeInstanceOf(Uuid);
    expect(saved.workerId.value).toBe(workerId);
    expect(saved.reviewCycleId.value).toBe(reviewCycleId);
    expect(saved.managerId.value).toBe(managerId);
  });

  it('normalizes string ids before creating calibration sessions', async () => {
    const repo = repoSpy();
    const handler = new CreateCalibrationSessionHandler(repo as never, fsm as never, publisher as never);

    await handler.handle(command('CreateCalibrationSession', 'CalibrationSession', {
      reviewCycleId,
      facilitatorId: managerId,
      participants: [workerId],
    }));

    const saved = repo.saved as { reviewCycleId: Uuid; facilitatorId: Uuid };
    expect(saved.reviewCycleId).toBeInstanceOf(Uuid);
    expect(saved.facilitatorId).toBeInstanceOf(Uuid);
    expect(saved.reviewCycleId.value).toBe(reviewCycleId);
    expect(saved.facilitatorId.value).toBe(managerId);
  });

  it('normalizes string ids before creating performance improvement plans', async () => {
    const repo = repoSpy();
    const handler = new CreatePerformanceImprovementPlanHandler(repo as never, fsm as never, publisher as never);

    await handler.handle(command('CreatePerformanceImprovementPlan', 'PerformanceImprovementPlan', {
      workerId,
      managerId,
      objectives: ['Improve delivery consistency'],
      currentPerformance: { summary: 'Below expected delivery quality', latestRating: 2.1 },
      planDurationDays: 90,
      milestones: [{ day: 30, title: 'First checkpoint', target: 'Show measurable progress' }],
      trackingMetrics: [{ metric: 'Quality score', current: 55, target: 80, unit: '%' }],
    }));

    const saved = repo.saved as { workerId: Uuid; managerId: Uuid };
    expect(saved.workerId).toBeInstanceOf(Uuid);
    expect(saved.managerId).toBeInstanceOf(Uuid);
    expect(saved.workerId.value).toBe(workerId);
    expect(saved.managerId.value).toBe(managerId);
  });
});
