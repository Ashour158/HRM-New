import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { PerformanceImprovementPlan } from './performance-improvement-plan.aggregate.js';

function createPlan(): PerformanceImprovementPlan {
  return PerformanceImprovementPlan.create(
    {
      id: Uuid.generate(),
      tenantId: Uuid.generate(),
      workerId: Uuid.generate(),
      managerId: Uuid.generate(),
      objectives: ['Improve delivery quality'],
      milestones: [
        { day: 30, title: 'First checkpoint', target: 'Reduce escaped defects', status: 'PENDING' },
      ],
      trackingMetrics: [
        { metric: 'Quality score', current: 55, target: 80, unit: '%' },
      ],
    },
    Uuid.generate(),
  );
}

describe('PerformanceImprovementPlan aggregate', () => {
  it('records manager checkpoints and keeps the action plan moving', () => {
    const plan = createPlan();
    plan.activate(Uuid.generate());
    plan.extend(new Date('2026-09-30'), Uuid.generate());

    (plan as unknown as {
      recordCheckpoint: (
        checkpoint: {
          milestoneTitle: string;
          milestoneStatus: string;
          metricUpdates: Array<{ metric: string; current: number }>;
          note: string;
        },
        correlationId: Uuid,
      ) => void;
    }).recordCheckpoint(
      {
        milestoneTitle: 'First checkpoint',
        milestoneStatus: 'ON_TRACK',
        metricUpdates: [{ metric: 'Quality score', current: 72 }],
        note: 'Early coaching is improving output quality.',
      },
      Uuid.generate(),
    );

    expect(plan.status).toBe('IN_PROGRESS');
    expect(plan.milestones[0].status).toBe('ON_TRACK');
    expect(plan.trackingMetrics[0].current).toBe(72);

    plan.enterReview(Uuid.generate());
    expect(plan.status).toBe('REVIEW_PENDING');
  });
});
