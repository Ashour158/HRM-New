import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, Consumer, Partitioners } from 'kafkajs';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus, EventHandler } from './event-bus.js';

@Injectable()
export class KafkaEventBus extends EventBus implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaEventBus.name);
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumers = new Map<string, Consumer>();

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
    for (const consumer of this.consumers.values()) {
      await consumer.disconnect();
    }
  }

  async publish(event: HrEventEnvelope<unknown>): Promise<void> {
    const topic = this.inferTopic(event.eventName);
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
      const topic = this.inferTopic(event.eventName);
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
    const key = `${topic}::${consumerGroup}`;
    if (this.consumers.has(key)) {
      this.logger.warn(`Consumer already registered for ${key}`);
      return;
    }

    const consumer = this.kafka.consumer({ groupId: consumerGroup });
    this.consumers.set(key, consumer);

    consumer.connect().then(async () => {
      await consumer.subscribe({ topic, fromBeginning: false });
      await consumer.run({
        eachMessage: async ({ message }) => {
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
        },
      });
    });
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

  private inferTopic(eventName: string): string {
    const prefix = eventName.split(/\b/)[0].toLowerCase();
    return `hrm.${prefix}.events`;
  }
}
