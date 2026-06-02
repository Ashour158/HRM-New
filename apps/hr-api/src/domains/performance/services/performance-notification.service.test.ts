import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { PerformanceNotificationService } from './performance-notification.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const cycleId = new Uuid('00000000-0000-0000-0000-000000000100');
const workerOne = new Uuid('00000000-0000-0000-0000-000000000201');
const workerTwo = new Uuid('00000000-0000-0000-0000-000000000202');

function worker(id: Uuid, firstName: string, lastName: string) {
  return {
    id,
    tenantId,
    firstName,
    lastName,
    email: { toString: () => `${firstName.toLowerCase()}@example.com` },
  };
}

describe('PerformanceNotificationService', () => {
  it('notifies every active employee when a review cycle is set up', async () => {
    const repository = { createMany: vi.fn().mockResolvedValue(undefined) };
    const outbox = { schedule: vi.fn().mockResolvedValue(undefined) };
    const workerRepo = {
      findActive: vi.fn().mockResolvedValue([
        worker(workerOne, 'Alice', 'Smith'),
        worker(workerTwo, 'Omar', 'Hassan'),
      ]),
    };
    const service = new PerformanceNotificationService(repository as never, workerRepo as never, outbox as never);

    const count = await service.notifyReviewCycleSetup({
      tenantId,
      cycleId,
      cycleName: 'FY26 Annual Review',
      actorId: new Uuid('00000000-0000-0000-0000-000000000010'),
    });

    expect(count).toBe(2);
    expect(repository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientWorkerId: workerOne.value,
        category: 'REVIEW_CYCLE_SETUP',
        relatedAggregateId: cycleId.value,
        title: 'FY26 Annual Review is ready',
      }),
      expect.objectContaining({
        recipientWorkerId: workerTwo.value,
        category: 'REVIEW_CYCLE_SETUP',
        relatedAggregateId: cycleId.value,
        title: 'FY26 Annual Review is ready',
      }),
    ]);
    expect(outbox.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'PerformanceNotificationsCreated',
        aggregateType: 'PerformanceReviewCycle',
        aggregateId: cycleId,
        privacy: expect.objectContaining({
          piiClassification: 'HIGH',
          employeeDataCategory: 'PERFORMANCE',
        }),
        payload: expect.objectContaining({
          category: 'REVIEW_CYCLE_SETUP',
          notificationCount: 2,
          recipientWorkerIds: [workerOne.value, workerTwo.value],
        }),
      }),
      tenantId,
      expect.any(Uuid),
    );
  });

  it('notifies the reviewer when a peer review assignment is created', async () => {
    const repository = { createMany: vi.fn().mockResolvedValue(undefined) };
    const outbox = { schedule: vi.fn().mockResolvedValue(undefined) };
    const workerRepo = { findActive: vi.fn() };
    const service = new PerformanceNotificationService(repository as never, workerRepo as never, outbox as never);

    const count = await service.notifyPeerReviewRequest({
      tenantId,
      cycleId,
      cycleName: 'FY26 360 Feedback',
      revieweeId: workerOne,
      reviewerId: workerTwo,
      isAnonymous: true,
    });

    expect(count).toBe(1);
    expect(repository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientWorkerId: workerTwo.value,
        category: 'PEER_REVIEW_REQUEST',
        title: 'Peer feedback requested',
        payload: expect.objectContaining({
          revieweeId: workerOne.value,
          isAnonymous: true,
        }),
      }),
    ]);
    expect(outbox.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'PerformanceNotificationsCreated',
        aggregateType: 'PerformanceFeedback360Response',
        privacy: expect.objectContaining({
          piiClassification: 'HIGH',
          subjectWorkerId: workerOne.value,
          employeeDataCategory: 'PERFORMANCE',
        }),
        payload: expect.objectContaining({
          category: 'PEER_REVIEW_REQUEST',
          notificationCount: 1,
          recipientWorkerIds: [workerTwo.value],
        }),
      }),
      tenantId,
      expect.any(Uuid),
    );
  });

  it('creates manager queue and reminder notifications for review tasks', async () => {
    const repository = { createMany: vi.fn().mockResolvedValue(undefined) };
    const outbox = { schedule: vi.fn().mockResolvedValue(undefined) };
    const workerRepo = { findActive: vi.fn() };
    const service = new PerformanceNotificationService(repository as never, workerRepo as never, outbox as never);

    const count = await service.notifyReviewAssignments({
      tenantId,
      cycleId,
      cycleName: 'FY26 Annual Review',
      assignments: [{
        reviewId: '00000000-0000-0000-0000-000000000301',
        workerId: workerOne,
        managerId: workerTwo,
        selfReviewDueDate: new Date('2026-06-15'),
        managerReviewDueDate: new Date('2026-06-30'),
      }],
      actorId: new Uuid('00000000-0000-0000-0000-000000000010'),
    });

    expect(count).toBe(3);
    expect(repository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ recipientWorkerId: workerOne.value, category: 'SELF_REVIEW_TASK' }),
      expect.objectContaining({ recipientWorkerId: workerTwo.value, category: 'MANAGER_REVIEW_QUEUE' }),
      expect.objectContaining({ recipientWorkerId: workerOne.value, category: 'SELF_REVIEW_REMINDER' }),
    ]);
    expect(outbox.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'PerformanceNotificationsCreated',
        payload: expect.objectContaining({
          category: 'REVIEW_ASSIGNMENTS_CREATED',
          notificationCount: 3,
        }),
      }),
      tenantId,
      expect.any(Uuid),
    );
  });
});
