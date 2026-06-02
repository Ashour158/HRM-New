import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { Goal } from '../aggregates/goal.aggregate.js';
import { PerformanceEventsPublisher } from './performance-events.publisher.js';

describe('PerformanceEventsPublisher', () => {
  it('publishes performance events with high-sensitivity performance privacy', async () => {
    const eventBus = { publish: vi.fn().mockResolvedValue(undefined) };
    const publisher = new PerformanceEventsPublisher(eventBus as never);
    const workerId = new Uuid('00000000-0000-0000-0000-000000000020');
    const goal = Goal.create({
      id: new Uuid('00000000-0000-0000-0000-000000000030'),
      tenantId: new Uuid('00000000-0000-0000-0000-000000000001'),
      workerId,
      title: 'Improve quality',
      targetValue: 90,
      dueDate: new Date('2026-12-31'),
    }, Uuid.generate());

    await publisher.publishFromAggregate(goal);

    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'GoalCreated',
      privacy: expect.objectContaining({
        piiClassification: 'HIGH',
        employeeDataCategory: 'PERFORMANCE',
        subjectWorkerId: workerId.value,
      }),
    }));
  });
});
