import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { HR_PAYROLL } from '@hcm/event-schemas';
import { KafkaEventBus } from '../src/platform/event-bus/kafka-event-bus.js';
import type { EventHandler } from '../src/platform/event-bus/event-bus.js';

let brokersReady = false;
let skipReason = '';
let bus: KafkaEventBus;

function parseBrokers(): string[] {
  return (process.env.KAFKA_BROKERS ?? '')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
}

async function connectToKafka(): Promise<boolean> {
  const brokers = parseBrokers();
  if (brokers.length === 0) { skipReason = 'KAFKA_BROKERS not set'; return false; }

  bus = new KafkaEventBus(brokers);
  try {
    await Promise.race([
      bus.onModuleInit(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('kafka producer connect timeout')), 15000)),
    ]);
    return true;
  } catch (e) {
    skipReason = e instanceof Error ? e.message : String(e);
    return false;
  }
}

beforeAll(async () => {
  brokersReady = await connectToKafka();
  // When a broker IS configured (CI), the real-broker path MUST run -- a connection
  // failure is a real failure, not a silent skip. Skipping is only allowed locally
  // when KAFKA_BROKERS is unset, mirroring integration-dead-letter.e2e.test.ts's
  // DATABASE_URL convention.
  if (!brokersReady && process.env.KAFKA_BROKERS) {
    throw new Error(`Kafka e2e requires a reachable broker (KAFKA_BROKERS is set): ${skipReason}`);
  }
});

afterAll(async () => {
  if (brokersReady) {
    await bus.onModuleDestroy().catch(() => undefined);
  }
});

describe('KafkaEventBus real broker integration (MEDIUM-BE-4)', () => {
  it('round-trips a published event through a real broker to a subscribed consumer group', async () => {
    if (!brokersReady) { console.warn(`[kafka.e2e] skipped: ${skipReason}`); return; }

    const consumerGroup = `kafka-e2e-${randomUUID()}`;
    const received: HrEventEnvelope<unknown>[] = [];
    let resolveReceived: () => void;
    const receivedPromise = new Promise<void>((resolve) => { resolveReceived = resolve; });
    const handler: EventHandler = {
      consumerGroup,
      handle: async (event) => {
        received.push(event);
        resolveReceived();
      },
    };

    bus.subscribe(HR_PAYROLL, consumerGroup, handler);
    await bus.onApplicationBootstrap();

    // The consumer group's rebalance/partition-assignment happens asynchronously after
    // run() resolves. KafkaEventBus subscribes with fromBeginning: false, so a message
    // published before the group is actively fetching would be missed -- give it a
    // moment to settle before publishing, same tradeoff any real consumer faces on
    // first boot.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const eventId = Uuid.generate();
    const event = {
      eventName: 'PayrollCycleOpened',
      eventId,
      tenantId: Uuid.generate(),
      aggregateType: 'payrollCycle',
      aggregateId: Uuid.generate(),
      payload: { marker: eventId.value },
      metadata: { correlationId: Uuid.generate() },
    } as HrEventEnvelope<unknown>;

    await bus.publish(event);

    await Promise.race([
      receivedPromise,
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timed out waiting for consumed event')), 20000)),
    ]);

    expect(received).toHaveLength(1);
    expect(received[0].eventId.value).toBe(eventId.value);
    expect(received[0].eventName).toBe('PayrollCycleOpened');
  }, 30000);
});
