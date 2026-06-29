import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { createSystemKyselyInstance } from '@hcm/database';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus } from '../event-bus/event-bus.js';
import { outboxMetadataForEvent, outboxRowToEnvelope, type OutboxEventRow } from './outbox-event-envelope.js';
import { ObservabilityMetricsService } from '../../observability/observability-metrics.service.js';

export type OutboxEvent = OutboxEventRow;

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private readonly db: Kysely<Database>;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly eventBus: EventBus,
    @Optional() @Inject(ObservabilityMetricsService)
    private readonly metrics?: ObservabilityMetricsService,
  ) {
    this.db = createSystemKyselyInstance();
  }

  async schedule(
    event: HrEventEnvelope<unknown>,
    tenantId: Uuid,
    correlationId: Uuid,
  ): Promise<void> {
    const metadata = outboxMetadataForEvent(event);
    await this.db
      .insertInto('outbox_events')
      .values({
        id: crypto.randomUUID(),
        tenant_id: tenantId.value,
        event_name: event.eventName,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId.value,
        payload: event.payload as unknown as Record<string, never>,
        metadata: metadata as unknown as Record<string, never>,
        event_schema_version: event.eventSchemaVersion,
        event_topic: metadata.topic,
        envelope_version: event.version,
        correlation_id: correlationId.value,
        causation_id: event.metadata.causationId?.value ?? null,
        created_at: new Date().toISOString(),
        published_at: null,
        publish_attempt_count: 0,
      })
      .execute();
    this.metrics?.recordOutboxPublish({ eventName: event.eventName, status: 'scheduled' });
  }

  async pollAndPublish(batchSize = 100): Promise<number> {
    return this.db.transaction().execute(async (trx) => {
      const events = await sql<OutboxEvent>`
        SELECT *
        FROM "hr_platform"."outbox_events"
        WHERE "published_at" IS NULL
          AND "publish_attempt_count" < 5
        ORDER BY "created_at" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `.execute(trx);

      let published = 0;
      for (const row of events.rows) {
        try {
          const event = this.rowToEnvelope(row);
          await this.eventBus.publish(event);
          await trx
            .updateTable('outbox_events')
            .set({ published_at: new Date() })
            .where('id', '=', row.id)
            .execute();
          this.metrics?.recordOutboxPublish({ eventName: row.event_name, status: 'published' });
          published++;
        } catch (err) {
          this.metrics?.recordOutboxPublish({ eventName: row.event_name, status: 'failed' });
          this.logger.error({
            type: 'OUTBOX_PUBLISH_FAILED',
            outboxEventId: row.id,
            error: err instanceof Error ? err.message : String(err),
          });
          await trx
            .updateTable('outbox_events')
            .set({
              publish_attempt_count: (row.publish_attempt_count ?? 0) + 1,
              last_error: err instanceof Error ? err.message : String(err),
            })
            .where('id', '=', row.id)
            .execute();
        }
      }
      return published;
    });
  }

  async publishOutboxEvent(tenantId: Uuid, outboxEventId: string): Promise<number> {
    const row = await this.db
      .selectFrom('outbox_events')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', outboxEventId)
      .where('published_at', 'is', null)
      .executeTakeFirst();
    if (!row) return 0;

    try {
      const event = this.rowToEnvelope(row as unknown as OutboxEvent);
      await this.eventBus.publish(event);
      await this.db
        .updateTable('outbox_events')
        .set({ published_at: new Date() })
        .where('id', '=', outboxEventId)
        .execute();
      this.metrics?.recordOutboxPublish({ eventName: row.event_name, status: 'published' });
      return 1;
    } catch (err) {
      this.metrics?.recordOutboxPublish({ eventName: row.event_name, status: 'failed' });
      this.logger.error({
        type: 'OUTBOX_TARGETED_PUBLISH_FAILED',
        outboxEventId,
        error: err instanceof Error ? err.message : String(err),
      });
      await this.db
        .updateTable('outbox_events')
        .set({
          publish_attempt_count: Number(row.publish_attempt_count ?? 0) + 1,
          last_error: err instanceof Error ? err.message : String(err),
        })
        .where('id', '=', outboxEventId)
        .execute();
      return 0;
    }
  }

  startPolling(intervalMs = 5000): void {
    if (this.pollingInterval) {
      return;
    }
    this.pollingInterval = setInterval(() => {
      this.pollAndPublish().catch((err) => {
        this.logger.error({ type: 'OUTBOX_POLL_ERROR', error: String(err) });
      });
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private rowToEnvelope(row: OutboxEvent): HrEventEnvelope<unknown> {
    return outboxRowToEnvelope(row);
  }
}
