import { Injectable, Logger } from '@nestjs/common';
import { Kysely } from 'kysely';
import type { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { InboxDeduplicator } from './inbox-deduplicator.js';

export interface InboxEvent {
  id: Uuid;
  tenantId: Uuid;
  consumerName: string;
  consumerVersion: string;
  sourceEventId: Uuid;
  sourceTopic: string;
  sourcePartition: number;
  sourceOffset: number;
  eventName: string;
  aggregateType: string;
  aggregateId: Uuid;
  processingStatus: string;
  retryCount: number;
  nextRetryAt: Date | null;
  errorSummary: string | null;
  processedAt: Date | null;
  createdAt: Date;
}

export interface InboxEventHandler {
  handle(event: HrEventEnvelope<unknown>): Promise<void>;
}

@Injectable()
export class InboxConsumer {
  private readonly logger = new Logger(InboxConsumer.name);
  private readonly db: Kysely<Database>;

  constructor(private readonly deduplicator: InboxDeduplicator) {
    this.db = createKyselyInstance(getPool());
  }

  async consume(
    event: HrEventEnvelope<unknown>,
    consumerName: string,
    consumerVersion: string,
    handler: InboxEventHandler,
  ): Promise<void> {
    const isDup = await this.deduplicator.isProcessed(
      event.eventId,
      consumerName,
      consumerVersion,
    );
    if (isDup) {
      this.logger.log({ type: 'INBOX_DEDUPLICATED', eventId: event.eventId.value, consumerName });
      return;
    }

    const inboxId = crypto.randomUUID() as unknown as Uuid;
    await this.db
      .insertInto('inbox_events')
      .values({
        id: inboxId.value,
        tenant_id: event.tenantId.value,
        consumer_name: consumerName,
        consumer_version: consumerVersion,
        source_event_id: event.eventId.value,
        source_topic: this.inferTopic(event.eventName),
        source_partition: 0,
        source_offset: 0,
        event_name: event.eventName,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId.value,
        processing_status: 'IN_PROGRESS',
        retry_count: 0,
        next_retry_at: null,
        error_summary: null,
        processed_at: null,
        created_at: new Date().toISOString(),
      })
      .execute();

    try {
      await handler.handle(event);
      await this.db
        .updateTable('inbox_events')
        .set({ processing_status: 'SUCCESS', processed_at: new Date() })
        .where('id', '=', inboxId.value)
        .execute();
    } catch (err) {
      const isRetryable = this.isRetryableError(err);
      const status = isRetryable ? 'FAILED_RETRYABLE' : 'FAILED_NON_RETRYABLE';
      const retryCount = isRetryable ? 1 : 0;
      const nextRetryAt = isRetryable ? new Date(Date.now() + 60_000) : null;

      await this.db
        .updateTable('inbox_events')
        .set({
          processing_status: status,
          retry_count: retryCount,
          next_retry_at: nextRetryAt,
          error_summary: err instanceof Error ? err.message : String(err),
        })
        .where('id', '=', inboxId.value)
        .execute();

      throw err;
    }
  }

  async getDeadLetterEvents(consumerName: string): Promise<InboxEvent[]> {
    const rows = await this.db
      .selectFrom('inbox_events')
      .selectAll()
      .where('consumer_name', '=', consumerName)
      .where('processing_status', '=', 'FAILED_NON_RETRYABLE')
      .execute();
    return rows.map((r) => this.toInboxEvent(r as Record<string, unknown>));
  }

  async retryEvent(inboxEventId: Uuid): Promise<void> {
    await this.db
      .updateTable('inbox_events')
      .set({
        processing_status: 'IN_PROGRESS',
        retry_count: 0,
        next_retry_at: null,
        error_summary: null,
      })
      .where('id', '=', inboxEventId.value)
      .execute();
  }

  private isRetryableError(err: unknown): boolean {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      return !['SCHEMA_VALIDATION_ERROR', 'DECRYPTION_ERROR', 'UNKNOWN_EVENT_TYPE'].includes(code);
    }
    return true;
  }

  private inferTopic(eventName: string): string {
    const prefix = eventName.split(/\b/)[0].toLowerCase();
    return `hrm.${prefix}.events`;
  }

  private toInboxEvent(r: Record<string, unknown>): InboxEvent {
    return {
      id: (r.id as string) as unknown as Uuid,
      tenantId: (r.tenant_id as string) as unknown as Uuid,
      consumerName: r.consumer_name as string,
      consumerVersion: r.consumer_version as string,
      sourceEventId: (r.source_event_id as string) as unknown as Uuid,
      sourceTopic: r.source_topic as string,
      sourcePartition: r.source_partition as number,
      sourceOffset: r.source_offset as number,
      eventName: r.event_name as string,
      aggregateType: r.aggregate_type as string,
      aggregateId: (r.aggregate_id as string) as unknown as Uuid,
      processingStatus: r.processing_status as string,
      retryCount: r.retry_count as number,
      nextRetryAt: r.next_retry_at as Date | null,
      errorSummary: r.error_summary as string | null,
      processedAt: r.processed_at as Date | null,
      createdAt: r.created_at as Date,
    };
  }
}
