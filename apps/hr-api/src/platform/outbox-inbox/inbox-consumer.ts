import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Kysely } from 'kysely';
import type { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { getTopicForEvent, type HrEventEnvelope } from '@hcm/event-schemas';
import { InboxDeduplicator } from './inbox-deduplicator.js';
import { outboxRowToEnvelope, type OutboxEventRow } from './outbox-event-envelope.js';
import { ObservabilityMetricsService } from '../../observability/observability-metrics.service.js';

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
  private readonly replayHandlers = new Map<string, InboxEventHandler>();
  private readonly metrics?: ObservabilityMetricsService;

  constructor(
    private readonly deduplicator: InboxDeduplicator,
    @Optional() @Inject(ObservabilityMetricsService)
    metricsOrDb?: ObservabilityMetricsService | Kysely<Database>,
    @Optional() db?: Kysely<Database>,
  ) {
    if (isMetricsService(metricsOrDb)) {
      this.metrics = metricsOrDb;
      this.db = db ?? createKyselyInstance(getPool());
    } else {
      this.db = metricsOrDb ?? createKyselyInstance(getPool());
    }
  }

  registerReplayHandler(
    consumerName: string,
    consumerVersion: string,
    handler: InboxEventHandler,
  ): void {
    this.replayHandlers.set(this.replayHandlerKey(consumerName, consumerVersion), handler);
  }

  async consume(
    event: HrEventEnvelope<unknown>,
    consumerName: string,
    consumerVersion: string,
    handler: InboxEventHandler,
  ): Promise<void> {
    const sourceEventId = uuidValue(event.eventId);
    const tenantId = uuidValue(event.tenantId);
    const aggregateId = uuidValue(event.aggregateId);
    const isDup = await this.deduplicator.isProcessed(
      { value: sourceEventId } as Uuid,
      consumerName,
      consumerVersion,
    );
    if (isDup) {
      this.metrics?.recordInboxProcess({ consumerName, eventName: event.eventName, status: 'deduplicated' });
      this.logger.log({ type: 'INBOX_DEDUPLICATED', eventId: sourceEventId, consumerName });
      return;
    }

    const existing = await this.db
      .selectFrom('inbox_events')
      .select(['id', 'processing_status', 'retry_count'])
      .where('source_event_id', '=', sourceEventId)
      .where('consumer_name', '=', consumerName)
      .where('consumer_version', '=', consumerVersion)
      .executeTakeFirst();

    if (existing && ['SUCCESS', 'SKIPPED'].includes(existing.processing_status)) {
      this.metrics?.recordInboxProcess({ consumerName, eventName: event.eventName, status: 'deduplicated' });
      this.logger.log({ type: 'INBOX_DEDUPLICATED', eventId: sourceEventId, consumerName });
      return;
    }

    const inboxId = existing?.id ?? crypto.randomUUID();
    if (existing) {
      await this.db
        .updateTable('inbox_events')
        .set({
          processing_status: 'IN_PROGRESS',
          next_retry_at: null,
          error_summary: null,
          processed_at: null,
        })
        .where('id', '=', inboxId)
        .execute();
    } else {
      await this.db
        .insertInto('inbox_events')
        .values({
          id: inboxId,
          tenant_id: tenantId,
          consumer_name: consumerName,
          consumer_version: consumerVersion,
          source_event_id: sourceEventId,
          source_topic: getTopicForEvent(event),
          source_partition: 0,
          source_offset: 0,
          event_name: event.eventName,
          aggregate_type: event.aggregateType,
          aggregate_id: aggregateId,
          processing_status: 'IN_PROGRESS',
          retry_count: 0,
          next_retry_at: null,
          error_summary: null,
          processed_at: null,
          created_at: new Date().toISOString(),
        })
        .execute();
    }

    try {
      await handler.handle(event);
      await this.db
        .updateTable('inbox_events')
        .set({ processing_status: 'SUCCESS', processed_at: new Date() })
        .where('id', '=', inboxId)
        .execute();
      this.metrics?.recordInboxProcess({ consumerName, eventName: event.eventName, status: 'success' });
    } catch (err) {
      const isRetryable = this.isRetryableError(err);
      const status = isRetryable ? 'FAILED_RETRYABLE' : 'FAILED_NON_RETRYABLE';
      const retryCount = isRetryable ? Number(existing?.retry_count ?? 0) + 1 : Number(existing?.retry_count ?? 0);
      const nextRetryAt = isRetryable ? new Date(Date.now() + 60_000) : null;

      await this.db
        .updateTable('inbox_events')
        .set({
          processing_status: status,
          retry_count: retryCount,
          next_retry_at: nextRetryAt,
          error_summary: err instanceof Error ? err.message : String(err),
        })
        .where('id', '=', inboxId)
        .execute();
      this.metrics?.recordInboxProcess({
        consumerName,
        eventName: event.eventName,
        status: isRetryable ? 'failed_retryable' : 'failed_non_retryable',
      });

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

  async skipOrphanedEventsWithoutOutbox(
    consumerName: string,
    consumerVersion: string,
  ): Promise<number> {
    const rows = await this.db
      .selectFrom('inbox_events')
      .select(['id', 'source_event_id'])
      .where('consumer_name', '=', consumerName)
      .where('consumer_version', '=', consumerVersion)
      .where('processing_status', '=', 'IN_PROGRESS')
      .execute();

    let skipped = 0;
    for (const row of rows) {
      const outboxEvent = await this.db
        .selectFrom('outbox_events')
        .select('id')
        .where('id', '=', row.source_event_id)
        .executeTakeFirst();

      if (outboxEvent) continue;

      await this.db
        .updateTable('inbox_events')
        .set({
          processing_status: 'SKIPPED',
          processed_at: new Date(),
          next_retry_at: null,
          error_summary: 'Legacy inbox event has no matching outbox event and cannot be replayed.',
        })
        .where('id', '=', row.id)
        .execute();
      this.metrics?.recordInboxProcess({ consumerName, eventName: 'LegacyInboxEvent', status: 'skipped' });
      skipped++;
    }

    if (skipped > 0) {
      this.logger.warn({
        type: 'INBOX_ORPHANED_EVENTS_SKIPPED',
        consumerName,
        consumerVersion,
        skipped,
      });
    }

    return skipped;
  }

  async recoverStaleInProgressEvents(
    olderThan: Date,
  ): Promise<{ retryable: number; skipped: number }> {
    const rows = await this.db
      .selectFrom('inbox_events')
      .select(['id', 'source_event_id', 'retry_count', 'created_at'])
      .where('processing_status', '=', 'IN_PROGRESS')
      .execute();

    let retryable = 0;
    let skipped = 0;
    for (const row of rows) {
      const createdAt = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
      if (Number.isNaN(createdAt.getTime()) || createdAt >= olderThan) continue;

      const outboxEvent = await this.db
        .selectFrom('outbox_events')
        .select('id')
        .where('id', '=', row.source_event_id)
        .executeTakeFirst();

      if (outboxEvent) {
        await this.db
          .updateTable('inbox_events')
          .set({
            processing_status: 'FAILED_RETRYABLE',
            retry_count: Number(row.retry_count ?? 0) + 1,
            next_retry_at: new Date(),
            error_summary: 'Recovered stale in-progress inbox event after process interruption.',
          })
          .where('id', '=', row.id)
          .execute();
        this.metrics?.recordInboxProcess({ consumerName: 'inbox-recovery', eventName: 'RecoveredInboxEvent', status: 'failed_retryable' });
        retryable++;
        continue;
      }

      await this.db
        .updateTable('inbox_events')
        .set({
          processing_status: 'SKIPPED',
          processed_at: new Date(),
          next_retry_at: null,
          error_summary: 'Stale inbox event has no matching outbox event and cannot be replayed.',
        })
        .where('id', '=', row.id)
        .execute();
      this.metrics?.recordInboxProcess({ consumerName: 'inbox-recovery', eventName: 'StaleInboxEvent', status: 'skipped' });
      skipped++;
    }

    if (retryable > 0 || skipped > 0) {
      this.logger.warn({
        type: 'INBOX_STALE_IN_PROGRESS_RECOVERED',
        olderThan: olderThan.toISOString(),
        retryable,
        skipped,
      });
    }

    return { retryable, skipped };
  }

  async replayDueRetryableEvents(before: Date, batchSize = 50): Promise<number> {
    let replayed = 0;

    for (const [key, handler] of this.replayHandlers.entries()) {
      if (replayed >= batchSize) break;
      const [consumerName, consumerVersion] = key.split('::');
      const rows = await this.db
        .selectFrom('inbox_events')
        .selectAll()
        .where('consumer_name', '=', consumerName)
        .where('consumer_version', '=', consumerVersion)
        .where('processing_status', '=', 'FAILED_RETRYABLE')
        .where('next_retry_at', '<', before)
        .orderBy('next_retry_at', 'asc')
        .limit(batchSize - replayed)
        .execute();

      for (const row of rows) {
        const outboxEvent = await this.db
          .selectFrom('outbox_events')
          .selectAll()
          .where('id', '=', row.source_event_id)
          .executeTakeFirst();

        if (!outboxEvent) {
          await this.db
            .updateTable('inbox_events')
            .set({
              processing_status: 'SKIPPED',
              processed_at: new Date(),
              next_retry_at: null,
              error_summary: 'Retryable inbox event has no matching outbox event and cannot be replayed.',
            })
            .where('id', '=', row.id)
            .execute();
          this.metrics?.recordInboxProcess({ consumerName, eventName: row.event_name, status: 'skipped' });
          continue;
        }

        try {
          const event = outboxRowToEnvelope(outboxEvent as unknown as OutboxEventRow);
          await this.consume(event, consumerName, consumerVersion, handler);
          replayed++;
        } catch (err) {
          this.logger.error({
            type: 'INBOX_REPLAY_FAILED',
            inboxEventId: row.id,
            consumerName,
            consumerVersion,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    if (replayed > 0) {
      this.logger.log({
        type: 'INBOX_RETRYABLE_EVENTS_REPLAYED',
        replayed,
      });
    }

    return replayed;
  }

  async replayInboxEvent(tenantId: Uuid, inboxEventId: string): Promise<number> {
    const row = await this.db
      .selectFrom('inbox_events')
      .selectAll()
      .where('tenant_id', '=', uuidValue(tenantId))
      .where('id', '=', inboxEventId)
      .executeTakeFirst();
    if (!row || ['SUCCESS', 'SKIPPED'].includes(row.processing_status)) {
      return 0;
    }

    const handler = this.replayHandlers.get(this.replayHandlerKey(row.consumer_name, row.consumer_version));
    if (!handler) {
      await this.db
        .updateTable('inbox_events')
        .set({
          processing_status: 'FAILED_NON_RETRYABLE',
          next_retry_at: null,
          error_summary: 'No registered replay handler exists for this inbox consumer.',
        })
        .where('id', '=', row.id)
        .execute();
      this.metrics?.recordInboxProcess({ consumerName: row.consumer_name, eventName: row.event_name, status: 'failed_non_retryable' });
      return 0;
    }

    const outboxEvent = await this.db
      .selectFrom('outbox_events')
      .selectAll()
      .where('tenant_id', '=', uuidValue(tenantId))
      .where('id', '=', row.source_event_id)
      .executeTakeFirst();

    if (!outboxEvent) {
      await this.db
        .updateTable('inbox_events')
        .set({
          processing_status: 'SKIPPED',
          processed_at: new Date(),
          next_retry_at: null,
          error_summary: 'Retryable inbox event has no matching outbox event and cannot be replayed.',
        })
        .where('id', '=', row.id)
        .execute();
      this.metrics?.recordInboxProcess({ consumerName: row.consumer_name, eventName: row.event_name, status: 'skipped' });
      return 0;
    }

    try {
      const event = outboxRowToEnvelope(outboxEvent as unknown as OutboxEventRow);
      await this.consume(event, row.consumer_name, row.consumer_version, handler);
      return 1;
    } catch (err) {
      this.logger.error({
        type: 'INBOX_TARGETED_REPLAY_FAILED',
        inboxEventId: row.id,
        consumerName: row.consumer_name,
        consumerVersion: row.consumer_version,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
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

  private replayHandlerKey(consumerName: string, consumerVersion: string): string {
    return `${consumerName}::${consumerVersion}`;
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

function uuidValue(value: unknown): string {
  if (typeof value === 'string') return value;
  const uuidLike = value as { value?: unknown } | undefined;
  if (typeof uuidLike?.value === 'string') return uuidLike.value;
  throw new Error('Event envelope is missing a UUID value');
}

function isMetricsService(value: unknown): value is ObservabilityMetricsService {
  return Boolean(value && typeof value === 'object' && 'recordInboxProcess' in value);
}
