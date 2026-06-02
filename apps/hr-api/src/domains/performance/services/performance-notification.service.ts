import { Injectable } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { OutboxPublisher } from '../../../platform/outbox-inbox/outbox-publisher.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { PerformanceNotificationRepository, type PerformanceNotificationInput } from '../repositories/performance-notification.repository.js';

@Injectable()
export class PerformanceNotificationService {
  constructor(
    private readonly repository: PerformanceNotificationRepository,
    private readonly workerRepo: WorkerRepository,
    private readonly outboxPublisher: OutboxPublisher,
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
    await this.scheduleNotificationEvent({
      tenantId: input.tenantId,
      aggregateType: 'PerformanceReviewCycle',
      aggregateId: input.cycleId,
      category: 'REVIEW_CYCLE_SETUP',
      notifications,
    });
    return notifications.length;
  }

  async notifyReviewAssignments(input: {
    tenantId: Uuid;
    cycleId: Uuid;
    cycleName: string;
    assignments: Array<{
      reviewId: string;
      workerId: Uuid;
      managerId?: Uuid;
      selfReviewDueDate?: Date;
      managerReviewDueDate?: Date;
    }>;
    actorId?: Uuid;
  }): Promise<number> {
    const notifications: PerformanceNotificationInput[] = [];

    for (const assignment of input.assignments) {
      notifications.push({
        tenantId: input.tenantId.value,
        recipientWorkerId: assignment.workerId.value,
        category: 'SELF_REVIEW_TASK',
        title: 'Self review assigned',
        body: `Your self review for ${input.cycleName} is ready.`,
        relatedAggregateType: 'PerformanceReview',
        relatedAggregateId: assignment.reviewId,
        payload: {
          cycleId: input.cycleId.value,
          reviewId: assignment.reviewId,
          dueDate: assignment.selfReviewDueDate?.toISOString(),
          action: 'SUBMIT_SELF_REVIEW',
        },
        createdBy: input.actorId?.value,
      });

      if (assignment.managerId) {
        notifications.push({
          tenantId: input.tenantId.value,
          recipientWorkerId: assignment.managerId.value,
          category: 'MANAGER_REVIEW_QUEUE',
          title: 'Manager review assigned',
          body: `A team member review for ${input.cycleName} is waiting in your manager queue.`,
          relatedAggregateType: 'PerformanceReview',
          relatedAggregateId: assignment.reviewId,
          payload: {
            cycleId: input.cycleId.value,
            reviewId: assignment.reviewId,
            employeeWorkerId: assignment.workerId.value,
            dueDate: assignment.managerReviewDueDate?.toISOString(),
            action: 'SUBMIT_MANAGER_REVIEW',
          },
          createdBy: input.actorId?.value,
        });
      }

      notifications.push({
        tenantId: input.tenantId.value,
        recipientWorkerId: assignment.workerId.value,
        category: 'SELF_REVIEW_REMINDER',
        title: 'Self review reminder scheduled',
        body: `Reminder scheduled for ${input.cycleName}.`,
        relatedAggregateType: 'PerformanceReview',
        relatedAggregateId: assignment.reviewId,
        payload: {
          cycleId: input.cycleId.value,
          reviewId: assignment.reviewId,
          dueDate: assignment.selfReviewDueDate?.toISOString(),
          reminderType: 'BEFORE_DUE_DATE',
        },
        createdBy: input.actorId?.value,
      });
    }

    await this.repository.createMany(notifications);
    await this.scheduleNotificationEvent({
      tenantId: input.tenantId,
      aggregateType: 'PerformanceReviewCycle',
      aggregateId: input.cycleId,
      category: 'REVIEW_ASSIGNMENTS_CREATED',
      notifications,
    });
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
    await this.scheduleNotificationEvent({
      tenantId: input.tenantId,
      aggregateType: 'PerformanceFeedback360Response',
      aggregateId: input.feedback360ResponseId ? new Uuid(input.feedback360ResponseId) : input.cycleId,
      category: 'PEER_REVIEW_REQUEST',
      notifications: [{
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
      }],
      subjectWorkerId: input.revieweeId.value,
    });
    return 1;
  }

  private async scheduleNotificationEvent(input: {
    tenantId: Uuid;
    aggregateType: string;
    aggregateId: Uuid;
    category: string;
    notifications: PerformanceNotificationInput[];
    subjectWorkerId?: string;
  }): Promise<void> {
    if (input.notifications.length === 0) return;

    const correlationId = Uuid.generate();
    const event: HrEventEnvelope<{
      category: string;
      notificationCount: number;
      recipientWorkerIds: string[];
      relatedAggregateIds: string[];
    }> = {
      eventId: Uuid.generate(),
      eventName: 'PerformanceNotificationsCreated',
      eventSchemaVersion: 1,
      tenantId: input.tenantId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: {
        category: input.category,
        notificationCount: input.notifications.length,
        recipientWorkerIds: input.notifications.map((notification) => notification.recipientWorkerId),
        relatedAggregateIds: Array.from(new Set(input.notifications.map((notification) => notification.relatedAggregateId).filter((id): id is string => !!id))),
      },
      metadata: {
        correlationId,
        requestHash: 'performance-notifications',
        clientType: 'SYSTEM',
        hrDataSensitivity: 'HIGH',
      },
      privacy: createPrivacyForEvent('HIGH', input.subjectWorkerId, 'PERFORMANCE'),
      occurredAt: new Date(),
      version: 1,
    };

    await this.outboxPublisher.schedule(event, input.tenantId, correlationId);
  }
}
