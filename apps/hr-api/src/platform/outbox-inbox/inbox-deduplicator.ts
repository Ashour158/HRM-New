import { Injectable, Optional } from '@nestjs/common';
import { Kysely } from 'kysely';
import type { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { createSystemKyselyInstance } from '@hcm/database';
import type { InboxEvent } from './inbox-consumer.js';

@Injectable()
export class InboxDeduplicator {
  private readonly db: Pick<Kysely<Database>, 'selectFrom' | 'updateTable'>;

  constructor(@Optional() db?: Pick<Kysely<Database>, 'selectFrom' | 'updateTable'>) {
    this.db = db ?? createSystemKyselyInstance();
  }

  async isProcessed(
    sourceEventId: Uuid,
    consumerName: string,
    consumerVersion: string,
  ): Promise<boolean> {
    const existing = await this.db
      .selectFrom('inbox_events')
      .select('id')
      .where('source_event_id', '=', sourceEventId.value)
      .where('consumer_name', '=', consumerName)
      .where('consumer_version', '=', consumerVersion)
      .where('processing_status', 'in', ['SUCCESS', 'SKIPPED'])
      .executeTakeFirst();
    return !!existing;
  }

  async markProcessed(event: InboxEvent): Promise<void> {
    await this.db
      .updateTable('inbox_events')
      .set({
        processing_status: 'SUCCESS',
        processed_at: new Date(),
      })
      .where('id', '=', event.id.value)
      .execute();
  }

  async getRetryableFailures(consumerName: string, before: Date): Promise<InboxEvent[]> {
    const rows = await this.db
      .selectFrom('inbox_events')
      .selectAll()
      .where('consumer_name', '=', consumerName)
      .where('processing_status', 'in', ['FAILED_RETRYABLE', 'IN_PROGRESS'])
      .where('next_retry_at', '<', before)
      .execute();

    return rows.map((r) => this.toInboxEvent(r as Record<string, unknown>));
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
