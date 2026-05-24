/**
 * Benefits Carrier Consumer
 *
 * Subscribes to hr.benefits.v1 and pushes enrollment / life-event data to the
 * external carrier via the BenefitsCarrierAdapter.
 *
 * Consumer group: carrier-integration-saga
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { isBenefitsEnrollmentFinalizedEvent, isLifeEventProcessedEvent } from '@hcm/event-schemas';
import { EventBus } from '../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../platform/outbox-inbox/inbox-consumer.js';
import { BenefitsCarrierAdapter } from '../adapters/benefits-carrier.adapter.js';

@Injectable()
export class BenefitsCarrierConsumer implements OnModuleInit {
  private readonly logger = new Logger(BenefitsCarrierConsumer.name);
  private readonly consumerName = 'carrier-integration-saga';
  private readonly consumerVersion = '1';

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly carrierAdapter: BenefitsCarrierAdapter,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('hr.benefits.v1', this.consumerName, {
      consumerGroup: this.consumerName,
      handle: async (event: HrEventEnvelope<unknown>) => {
        await this.inboxConsumer.consume(event, this.consumerName, this.consumerVersion, {
          handle: async () => this.handle(event),
        });
      },
    });
  }

  private async handle(event: HrEventEnvelope<unknown>): Promise<void> {
    if (isBenefitsEnrollmentFinalizedEvent(event)) {
      this.logger.log({
        type: 'CONSUMER_BENEFITS_ENROLLMENT_FINALIZED',
        enrollmentId: event.payload.enrollmentId.value,
        workerId: event.payload.workerId.value,
      });

      await this.carrierAdapter.sendEnrollment({
        enrollmentId: event.payload.enrollmentId,
        workerId: event.payload.workerId,
        programId: event.payload.enrollmentId, // placeholder – resolve from read model in production
        coverageStartDate: new Date().toISOString(),
      });
      return;
    }

    if (isLifeEventProcessedEvent(event)) {
      this.logger.log({
        type: 'CONSUMER_LIFE_EVENT_PROCESSED',
        lifeEventId: event.payload.lifeEventId.value,
        workerId: event.payload.workerId.value,
      });

      await this.carrierAdapter.sendLifeEventUpdate({
        lifeEventId: event.payload.lifeEventId,
        workerId: event.payload.workerId,
        eventType: 'UNKNOWN', // resolve from read model in production
        effectiveDate: new Date().toISOString(),
      });
      return;
    }

    this.logger.debug({ type: 'CONSUMER_EVENT_IGNORED', eventName: event.eventName });
  }
}
