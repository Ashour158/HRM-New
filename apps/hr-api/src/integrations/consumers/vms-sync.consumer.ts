/**
 * VMS Sync Consumer
 *
 * Subscribes to hr.contingent.v1 and syncs contingent workforce data to the
 * external Vendor Management System.
 *
 * Events handled:
 * - ContingentAssignmentActivated → syncWorkerAssignment
 * - SowEngagementCreated          → syncSowEngagement
 *
 * Consumer group: vms-integration-saga
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus } from '../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../platform/outbox-inbox/inbox-consumer.js';
import { VmsIntegrationAdapter } from '../adapters/vms-integration.adapter.js';

@Injectable()
export class VmsSyncConsumer implements OnModuleInit {
  private readonly logger = new Logger(VmsSyncConsumer.name);
  private readonly consumerName = 'vms-integration-saga';
  private readonly consumerVersion = '1';

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly vmsAdapter: VmsIntegrationAdapter,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('hr.contingent.v1', this.consumerName, {
      consumerGroup: this.consumerName,
      handle: async (event: HrEventEnvelope<unknown>) => {
        await this.inboxConsumer.consume(event, this.consumerName, this.consumerVersion, {
          handle: async () => this.handle(event),
        });
      },
    });
  }

  private async handle(event: HrEventEnvelope<unknown>): Promise<void> {
    if (event.eventName === 'ContingentAssignmentActivated') {
      const payload = event.payload as {
        assignmentId: { value: string };
        workerId: { value: string };
        vendorId: { value: string };
        startDate: string;
        endDate?: string;
        rateAmount: number;
        rateCurrency: string;
      };
      this.logger.log({
        type: 'CONSUMER_CONTINGENT_ASSIGNMENT_ACTIVATED',
        assignmentId: payload.assignmentId.value,
      });

      await this.vmsAdapter.syncWorkerAssignment({
        assignmentId: payload.assignmentId as unknown as import('@hcm/shared-kernel').Uuid,
        workerId: payload.workerId as unknown as import('@hcm/shared-kernel').Uuid,
        vendorId: payload.vendorId as unknown as import('@hcm/shared-kernel').Uuid,
        startDate: payload.startDate,
        endDate: payload.endDate,
        rateAmount: payload.rateAmount,
        rateCurrency: payload.rateCurrency,
      });
      return;
    }

    if (event.eventName === 'SowEngagementCreated') {
      const payload = event.payload as {
        sowId: { value: string };
        vendorId: { value: string };
        totalValue: number;
        currency: string;
        startDate: string;
        endDate: string;
      };
      this.logger.log({
        type: 'CONSUMER_SOW_ENGAGEMENT_CREATED',
        sowId: payload.sowId.value,
      });

      await this.vmsAdapter.syncSowEngagement({
        sowId: payload.sowId as unknown as import('@hcm/shared-kernel').Uuid,
        vendorId: payload.vendorId as unknown as import('@hcm/shared-kernel').Uuid,
        totalValue: payload.totalValue,
        currency: payload.currency,
        startDate: payload.startDate,
        endDate: payload.endDate,
      });
      return;
    }

    this.logger.debug({ type: 'CONSUMER_EVENT_IGNORED', eventName: event.eventName });
  }
}
