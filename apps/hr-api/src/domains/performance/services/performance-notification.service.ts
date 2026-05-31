import { Injectable } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { PerformanceNotificationRepository, type PerformanceNotificationInput } from '../repositories/performance-notification.repository.js';

@Injectable()
export class PerformanceNotificationService {
  constructor(
    private readonly repository: PerformanceNotificationRepository,
    private readonly workerRepo: WorkerRepository,
  ) {}

  async notifyReviewCycleSetup(input: {
    tenantId: Uuid;
    cycleId: Uuid;
    cycleName: string;
    actorId?: Uuid;
  }): Promise<number> {
    const activeWorkers = await this.workerRepo.findActive();
    const notifications: PerformanceNotificationInput[] = activeWorkers
      .filter((worker) => worker.tenantId.value === input.tenantId.value)
      .map((worker) => ({
        tenantId: input.tenantId.value,
        recipientWorkerId: worker.id.value,
        category: 'REVIEW_CYCLE_SETUP',
        title: `${input.cycleName} is ready`,
        body: 'Your performance review cycle has been set up. Goals, self review, manager review, and peer feedback tasks may now be assigned.',
        relatedAggregateType: 'PerformanceReviewCycle',
        relatedAggregateId: input.cycleId.value,
        payload: {
          cycleId: input.cycleId.value,
          cycleName: input.cycleName,
          nextStep: 'Open Performance Center',
        },
        createdBy: input.actorId?.value,
      }));

    await this.repository.createMany(notifications);
    return notifications.length;
  }

  async notifyPeerReviewRequest(input: {
    tenantId: Uuid;
    cycleId: Uuid;
    cycleName: string;
    revieweeId: Uuid;
    reviewerId: Uuid;
    feedback360ResponseId?: string;
    isAnonymous: boolean;
  }): Promise<number> {
    await this.repository.createMany([{
      tenantId: input.tenantId.value,
      recipientWorkerId: input.reviewerId.value,
      category: 'PEER_REVIEW_REQUEST',
      title: 'Peer feedback requested',
      body: `You have been asked to submit ${input.isAnonymous ? 'anonymous ' : ''}peer feedback for ${input.cycleName}.`,
      relatedAggregateType: 'PerformanceFeedback360Response',
      relatedAggregateId: input.feedback360ResponseId,
      payload: {
        cycleId: input.cycleId.value,
        cycleName: input.cycleName,
        revieweeId: input.revieweeId.value,
        reviewerId: input.reviewerId.value,
        isAnonymous: input.isAnonymous,
      },
    }]);
    return 1;
  }
}
