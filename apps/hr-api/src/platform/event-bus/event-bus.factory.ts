import { EventBus, InMemoryEventBus } from './event-bus.js';
import { KafkaEventBus } from './kafka-event-bus.js';

/**
 * Select the event bus from configuration (ARCH-4).
 *
 * With brokers configured -> Kafka. Without brokers the in-memory bus does NOT
 * publish events cross-service, so silently using it in production would drop the
 * event nervous system. Fail fast in production; allow the in-memory bus only in
 * dev/test where single-process delivery is intended.
 */
export function createEventBus(): EventBus {
  const brokers = (process.env.KAFKA_BROKERS ?? '')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);

  if (brokers.length > 0) {
    return new KafkaEventBus(brokers);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'KAFKA_BROKERS must be configured in production; refusing to start with the in-memory event bus (cross-service events would not be published).',
    );
  }
  return new InMemoryEventBus();
}
