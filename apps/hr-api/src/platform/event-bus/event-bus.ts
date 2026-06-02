import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { getTopicForEvent, type HrEventEnvelope } from '@hcm/event-schemas';

export interface EventHandler {
  consumerGroup: string;
  handle(event: HrEventEnvelope<unknown>): Promise<void>;
}

export abstract class EventBus {
  abstract publish(event: HrEventEnvelope<unknown>): Promise<void>;
  abstract publishAll(events: HrEventEnvelope<unknown>[]): Promise<void>;
  abstract subscribe(topic: string, consumerGroup: string, handler: EventHandler): void;
}

@Injectable()
export class InMemoryEventBus extends EventBus {
  private readonly logger = new Logger(InMemoryEventBus.name);
  private readonly subject = new Subject<{ topic: string; event: HrEventEnvelope<unknown> }>();
  private readonly handlers = new Map<string, EventHandler[]>();

  async publish(event: HrEventEnvelope<unknown>): Promise<void> {
    const topic = getTopicForEvent(event);
    this.logger.log({
      type: 'EVENT_PUBLISHED',
      topic,
      eventName: event.eventName,
      eventId: event.eventId,
      tenantId: event.tenantId,
      correlationId: event.metadata.correlationId,
    });
    this.subject.next({ topic, event });
  }

  async publishAll(events: HrEventEnvelope<unknown>[]): Promise<void> {
    await Promise.all(events.map((e) => this.publish(e)));
  }

  subscribe(topic: string, consumerGroup: string, handler: EventHandler): void {
    const key = `${topic}::${consumerGroup}`;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, []);
      this.subject
        .pipe(filter((msg) => msg.topic === topic))
        .subscribe(async (msg) => {
          const handlers = this.handlers.get(key) ?? [];
          for (const h of handlers) {
            try {
              await h.handle(msg.event);
            } catch (err) {
              this.logger.error({
                type: 'EVENT_HANDLER_ERROR',
                topic,
                consumerGroup,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        });
    }
    this.handlers.get(key)!.push(handler);
  }
}
