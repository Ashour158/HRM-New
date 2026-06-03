import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { getTopicForEvent, type HrEventEnvelope } from '@hcm/event-schemas';

export interface EventPublicationDiagnostic {
  eventId: string;
  eventName: string;
  aggregateType: string;
  tenantId: string;
  topic: string;
  detectedAt: Date;
}

export interface EventPublicationDiagnostics {
  directPublications: EventPublicationDiagnostic[];
  duplicatePublications: EventPublicationDiagnostic[];
}

export interface EventHandler {
  consumerGroup: string;
  handle(event: HrEventEnvelope<unknown>): Promise<void>;
}

export abstract class EventBus {
  private readonly publishedEventIds = new Set<string>();
  private readonly diagnostics: EventPublicationDiagnostics = {
    directPublications: [],
    duplicatePublications: [],
  };

  abstract publish(event: HrEventEnvelope<unknown>): Promise<void>;
  abstract publishAll(events: HrEventEnvelope<unknown>[]): Promise<void>;
  abstract subscribe(topic: string, consumerGroup: string, handler: EventHandler): void;

  getPublicationDiagnostics(): EventPublicationDiagnostics {
    return {
      directPublications: [...this.diagnostics.directPublications],
      duplicatePublications: [...this.diagnostics.duplicatePublications],
    };
  }

  protected recordPublicationAttempt(event: HrEventEnvelope<unknown>, topic: string): { duplicate: boolean } {
    const eventId = event.eventId.value;
    if (this.publishedEventIds.has(eventId)) {
      this.diagnostics.duplicatePublications.push(this.toDiagnostic(event, topic));
      return { duplicate: true };
    }

    this.publishedEventIds.add(eventId);
    const metadata = event.metadata as EventPublicationMetadata;
    if (metadata.publicationSource !== 'OUTBOX' || !metadata.sourceOutboxEventId) {
      this.diagnostics.directPublications.push(this.toDiagnostic(event, topic));
    }
    return { duplicate: false };
  }

  private toDiagnostic(event: HrEventEnvelope<unknown>, topic: string): EventPublicationDiagnostic {
    return {
      eventId: event.eventId.value,
      eventName: event.eventName,
      aggregateType: event.aggregateType,
      tenantId: event.tenantId.value,
      topic,
      detectedAt: new Date(),
    };
  }
}

type EventPublicationMetadata = HrEventEnvelope<unknown>['metadata'] & {
  sourceOutboxEventId?: string;
  publicationSource?: 'OUTBOX' | 'DIRECT';
};

@Injectable()
export class InMemoryEventBus extends EventBus {
  private readonly logger = new Logger(InMemoryEventBus.name);
  private readonly subject = new Subject<{ topic: string; event: HrEventEnvelope<unknown> }>();
  private readonly handlers = new Map<string, EventHandler[]>();

  async publish(event: HrEventEnvelope<unknown>): Promise<void> {
    const topic = getTopicForEvent(event);
    const publication = this.recordPublicationAttempt(event, topic);
    if (publication.duplicate) return;

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
