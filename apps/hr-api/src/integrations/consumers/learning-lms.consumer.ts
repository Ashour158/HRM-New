/**
 * Learning LMS Consumer
 *
 * Subscribes to hr.learning.v1 and synchronises learning assignments with the
 * external LMS.
 *
 * Events handled:
 * - LearningAssignmentAssigned → pushAssignment
 * - LearningAssignmentCompleted → pullCompletion
 *
 * Consumer group: lms-integration-saga
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus } from '../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../platform/outbox-inbox/inbox-consumer.js';
import { LmsIntegrationAdapter } from '../adapters/lms-integration.adapter.js';

@Injectable()
export class LearningLmsConsumer implements OnModuleInit {
  private readonly logger = new Logger(LearningLmsConsumer.name);
  private readonly consumerName = 'lms-integration-saga';
  private readonly consumerVersion = '1';

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly lmsAdapter: LmsIntegrationAdapter,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('hr.learning.v1', this.consumerName, {
      consumerGroup: this.consumerName,
      handle: async (event: HrEventEnvelope<unknown>) => {
        await this.inboxConsumer.consume(event, this.consumerName, this.consumerVersion, {
          handle: async () => this.handle(event),
        });
      },
    });
  }

  private async handle(event: HrEventEnvelope<unknown>): Promise<void> {
    if (event.eventName === 'LearningAssignmentAssigned') {
      const payload = event.payload as {
        assignmentId: { value: string };
        workerId: { value: string };
        courseId: { value: string };
        dueDate?: string;
      };
      this.logger.log({
        type: 'CONSUMER_LEARNING_ASSIGNMENT_ASSIGNED',
        assignmentId: payload.assignmentId.value,
        workerId: payload.workerId.value,
      });

      await this.lmsAdapter.pushAssignment({
        assignmentId: payload.assignmentId as unknown as import('@hcm/shared-kernel').Uuid,
        workerId: payload.workerId as unknown as import('@hcm/shared-kernel').Uuid,
        courseId: payload.courseId as unknown as import('@hcm/shared-kernel').Uuid,
        dueDate: payload.dueDate,
      });
      return;
    }

    if (event.eventName === 'LearningAssignmentCompleted') {
      const payload = event.payload as { assignmentId: { value: string } };
      this.logger.log({
        type: 'CONSUMER_LEARNING_ASSIGNMENT_COMPLETED',
        assignmentId: payload.assignmentId.value,
      });

      await this.lmsAdapter.pullCompletion(payload.assignmentId as unknown as import('@hcm/shared-kernel').Uuid);
      return;
    }

    this.logger.debug({ type: 'CONSUMER_EVENT_IGNORED', eventName: event.eventName });
  }
}
