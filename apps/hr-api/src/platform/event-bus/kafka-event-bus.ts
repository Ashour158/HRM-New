import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, Consumer, Partitioners } from 'kafkajs';
import { getTopicForEvent, type HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus, EventHandler } from './event-bus.js';

@Injectable()
export class KafkaEventBus extends EventBus implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(KafkaEventBus.name);
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumers = new Map<string, {
    consumer: Consumer;
    topics: Set<string>;
    handlersByTopic: Map<string, EventHandler[]>;
    started: boolean;
    startPromise?: Promise<void>;
  }>();

  constructor(brokers: string[]) {
    super();
    this.kafka = new Kafka({
      clientId: 'hr-api',
      brokers: brokers.length > 0 ? brokers : ['localhost:9092'],
    });
    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
    for (const registration of this.consumers.values()) {
      await registration.consumer.disconnect();
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    await Promise.all(
      Array.from(this.consumers.entries()).map(([consumerGroup, registration]) =>
        this.startConsumerGroup(consumerGroup, registration),
      ),
    );
  }

  async publish(event: HrEventEnvelope<unknown>): Promise<void> {
    const topic = getTopicForEvent(event);
    await this.producer.send({
      topic,
      messages: [
        {
          key: event.aggregateId.value,
          value: JSON.stringify(event),
          headers: {
            eventName: event.eventName,
            tenantId: event.tenantId.value,
            correlationId: event.metadata.correlationId.value,
          },
        },
      ],
    });
  }

  async publishAll(events: HrEventEnvelope<unknown>[]): Promise<void> {
    const batches = new Map<string, HrEventEnvelope<unknown>[]>();
    for (const event of events) {
      const topic = getTopicForEvent(event);
      if (!batches.has(topic)) batches.set(topic, []);
      batches.get(topic)!.push(event);
    }
    for (const [topic, batch] of batches) {
      await this.producer.send({
        topic,
        messages: batch.map((event) => ({
          key: event.aggregateId.value,
          value: JSON.stringify(event),
          headers: {
            eventName: event.eventName,
            tenantId: event.tenantId.value,
            correlationId: event.metadata.correlationId.value,
          },
        })),
      });
    }
  }

  subscribe(topic: string, consumerGroup: string, handler: EventHandler): void {
    let registration = this.consumers.get(consumerGroup);
    if (!registration) {
      registration = {
        consumer: this.kafka.consumer({ groupId: consumerGroup }),
        topics: new Set<string>(),
        handlersByTopic: new Map<string, EventHandler[]>(),
        started: false,
      };
      this.consumers.set(consumerGroup, registration);
    }

    registration.topics.add(topic);
    const handlers = registration.handlersByTopic.get(topic) ?? [];
    handlers.push(handler);
    registration.handlersByTopic.set(topic, handlers);

    if (registration.started) {
      this.logger.warn({
        type: 'KAFKA_LATE_SUBSCRIPTION_IGNORED',
        topic,
        consumerGroup,
        reason: 'Kafka subscriptions must be registered before application bootstrap',
      });
    }
  }

  private async startConsumerGroup(
    consumerGroup: string,
    registration: {
      consumer: Consumer;
      topics: Set<string>;
      handlersByTopic: Map<string, EventHandler[]>;
      started: boolean;
      startPromise?: Promise<void>;
    },
  ): Promise<void> {
    if (registration.startPromise) {
      return registration.startPromise;
    }

    registration.startPromise = (async () => {
      await registration.consumer.connect();
      const topics = Array.from(registration.topics).sort();
      for (const topic of topics) {
        await registration.consumer.subscribe({ topic, fromBeginning: false });
      }
      await registration.consumer.run({
        eachMessage: async ({ topic, message }) => {
          const handlers = registration.handlersByTopic.get(topic) ?? [];
          for (const handler of handlers) {
            try {
              const event = JSON.parse(message.value?.toString() ?? '{}') as HrEventEnvelope<unknown>;
              await handler.handle(event);
            } catch (err) {
              this.logger.error({
                type: 'KAFKA_HANDLER_ERROR',
                topic,
                consumerGroup,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        },
      });
      registration.started = true;
      this.logger.log({
        type: 'KAFKA_CONSUMER_GROUP_STARTED',
        consumerGroup,
        topics,
      });
    })();

    return registration.startPromise;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.producer.send({
        topic: '__healthcheck',
        messages: [{ value: 'ping' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
