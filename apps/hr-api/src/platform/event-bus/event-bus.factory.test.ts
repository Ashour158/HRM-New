import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventBus } from './event-bus.factory.js';
import { InMemoryEventBus } from './event-bus.js';
import { KafkaEventBus } from './kafka-event-bus.js';

const ORIG_BROKERS = process.env.KAFKA_BROKERS;
const ORIG_ENV = process.env.NODE_ENV;

describe('createEventBus (ARCH-4)', () => {
  afterEach(() => {
    if (ORIG_BROKERS === undefined) delete process.env.KAFKA_BROKERS; else process.env.KAFKA_BROKERS = ORIG_BROKERS;
    process.env.NODE_ENV = ORIG_ENV;
    vi.restoreAllMocks();
  });

  it('returns a Kafka bus when brokers are configured', () => {
    process.env.KAFKA_BROKERS = 'broker-1:9092,broker-2:9092';
    expect(createEventBus()).toBeInstanceOf(KafkaEventBus);
  });

  it('returns the in-memory bus without brokers in development', () => {
    delete process.env.KAFKA_BROKERS;
    process.env.NODE_ENV = 'development';
    expect(createEventBus()).toBeInstanceOf(InMemoryEventBus);
  });

  it('FAILS FAST in production when no brokers are configured', () => {
    process.env.KAFKA_BROKERS = '';
    process.env.NODE_ENV = 'production';
    expect(() => createEventBus()).toThrow(/KAFKA_BROKERS/);
  });

  it('ignores blank/whitespace broker entries', () => {
    process.env.KAFKA_BROKERS = ' , ,';
    process.env.NODE_ENV = 'production';
    expect(() => createEventBus()).toThrow(/KAFKA_BROKERS/);
  });
});
