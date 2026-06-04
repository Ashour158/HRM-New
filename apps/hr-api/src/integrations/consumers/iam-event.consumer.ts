/**
 * IAM Event Consumer
 *
 * Subscribes to hr.core.v1 and drives IAM provisioning via the inbox pattern.
 *
 * Events handled:
 * - WorkerActivated   → provisionUser
 * - WorkerTerminated  → deprovisionUser
 * - JobAssignmentChanged → updateUserRoles (handled generically via event name)
 *
 * Consumer group: iam-provisioning-saga
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { isWorkerActivatedEvent, isWorkerTerminatedEvent } from '@hcm/event-schemas';
import { EventBus } from '../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../platform/outbox-inbox/inbox-consumer.js';
import { IamProvisioningAdapter } from '../adapters/iam-provisioning.adapter.js';

@Injectable()
export class IamEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(IamEventConsumer.name);
  private readonly consumerName = 'iam-provisioning-saga';
  private readonly consumerVersion = '1';

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly iamAdapter: IamProvisioningAdapter,
  ) {}

  onModuleInit(): void {
    this.inboxConsumer.registerReplayHandler(this.consumerName, this.consumerVersion, {
      handle: async (event) => this.handle(event),
    });
    this.eventBus.subscribe('hr.core.v1', this.consumerName, {
      consumerGroup: this.consumerName,
      handle: async (event: HrEventEnvelope<unknown>) => {
        await this.inboxConsumer.consume(event, this.consumerName, this.consumerVersion, {
          handle: async () => this.handle(event),
        });
      },
    });
  }

  private async handle(event: HrEventEnvelope<unknown>): Promise<void> {
    if (isWorkerActivatedEvent(event)) {
      this.logger.log({ type: 'CONSUMER_WORKER_ACTIVATED', workerId: event.payload.workerId.value });
      // In a real implementation, fetch worker email and roles from a read model
      await this.iamAdapter.provisionUser(event.payload.workerId, 'mock@example.com', []);
      return;
    }

    if (isWorkerTerminatedEvent(event)) {
      this.logger.log({ type: 'CONSUMER_WORKER_TERMINATED', workerId: event.payload.workerId.value });
      await this.iamAdapter.deprovisionUser(event.payload.workerId);
      return;
    }

    if (event.eventName === 'JobAssignmentChanged') {
      const payload = event.payload as { workerId: { value: string } };
      this.logger.log({ type: 'CONSUMER_JOB_ASSIGNMENT_CHANGED', workerId: payload.workerId.value });
      // Fetch updated roles from read model and sync
      await this.iamAdapter.updateUserRoles(payload.workerId as unknown as import('@hcm/shared-kernel').Uuid, []);
      return;
    }

    this.logger.debug({ type: 'CONSUMER_EVENT_IGNORED', eventName: event.eventName });
  }
}
