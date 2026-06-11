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
import { Uuid } from '@hcm/shared-kernel';
import { EventBus } from '../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../platform/outbox-inbox/inbox-consumer.js';
import { BenefitsCarrierAdapter } from '../adapters/benefits-carrier.adapter.js';

const BENEFITS_ENROLLMENT_EFFECTIVE = 'BenefitsEnrollmentEffective';
const BENEFITS_ENROLLMENT_FINALIZED = BENEFITS_ENROLLMENT_EFFECTIVE;
const LIFE_EVENT_PROCESSED = 'LifeEventProcessed';

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
    this.inboxConsumer.registerReplayHandler(this.consumerName, this.consumerVersion, {
      handle: async (event) => this.handle(event),
    });
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
    const payload = isRecord(event.payload) ? event.payload : {};

    if (event.eventName === BENEFITS_ENROLLMENT_EFFECTIVE || event.eventName === BENEFITS_ENROLLMENT_FINALIZED) {
      const enrollmentId = requiredUuid(payload.enrollmentId, 'enrollmentId');
      const workerId = requiredUuid(payload.workerId, 'workerId');
      const programId = requiredUuid(payload.programId, 'programId');
      this.logger.log({
        type: 'CONSUMER_BENEFITS_ENROLLMENT_FINALIZED',
        enrollmentId: enrollmentId.value,
        workerId: workerId.value,
      });

      await this.carrierAdapter.sendEnrollment({
        enrollmentId,
        workerId,
        programId,
        coverageStartDate: requiredString(payload.coverageStartDate, 'coverageStartDate'),
      });
      return;
    }

    if (event.eventName === LIFE_EVENT_PROCESSED) {
      const lifeEventId = requiredUuid(payload.lifeEventId, 'lifeEventId');
      const workerId = requiredUuid(payload.workerId, 'workerId');
      this.logger.log({
        type: 'CONSUMER_LIFE_EVENT_PROCESSED',
        lifeEventId: lifeEventId.value,
        workerId: workerId.value,
      });

      await this.carrierAdapter.sendLifeEventUpdate({
        lifeEventId,
        workerId,
        eventType: stringValue(payload.eventType) ?? stringValue(payload.lifeEventType) ?? missingString('eventType'),
        effectiveDate: requiredString(payload.effectiveDate, 'effectiveDate'),
      });
      return;
    }

    this.logger.debug({ type: 'CONSUMER_EVENT_IGNORED', eventName: event.eventName });
  }
}

function requiredUuid(value: unknown, field: string): Uuid {
  const uuid = uuidValue(value);
  if (!uuid) throw new Error(`Benefits carrier event payload is missing ${field}`);
  return uuid;
}

function requiredString(value: unknown, field: string): string {
  return stringValue(value) ?? missingString(field);
}

function missingString(field: string): never {
  throw new Error(`Benefits carrier event payload is missing ${field}`);
}

function uuidValue(value: unknown): Uuid | undefined {
  if (value instanceof Uuid) return value;
  if (typeof value === 'string' && Uuid.isValid(value)) return new Uuid(value);
  if (isRecord(value) && typeof value.value === 'string' && Uuid.isValid(value.value)) {
    return new Uuid(value.value);
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
