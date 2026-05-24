import { Injectable, Logger } from '@nestjs/common';
import { Kysely } from 'kysely';
import type { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { EventBus } from '../event-bus/event-bus.js';

export interface OutboxEvent {
  id: string;
  tenant_id: string;
  event_name: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  metadata: unknown;
  correlation_id: string | null;
  causation_id: string | null;
  created_at: Date;
  published_at: Date | null;
  publish_attempt_count: number;
}

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private readonly db: Kysely<Database>;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly eventBus: EventBus) {
    this.db = createKyselyInstance(getPool());
  }

  async schedule(
    event: HrEventEnvelope<unknown>,
    tenantId: Uuid,
    correlationId: Uuid,
  ): Promise<void> {
    await this.db
      .insertInto('outbox_events')
      .values({
        id: crypto.randomUUID(),
        tenant_id: tenantId.value,
        event_name: event.eventName,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId.value,
        payload: event.payload as unknown as Record<string, never>,
        metadata: event.metadata as unknown as Record<string, never>,
        correlation_id: correlationId.value,
        causation_id: event.metadata.causationId?.value ?? null,
        created_at: new Date().toISOString(),
        published_at: null,
        publish_attempt_count: 0,
      })
      .execute();
  }

  async pollAndPublish(batchSize = 100): Promise<number> {
    const events = await this.db
      .selectFrom('outbox_events')
      .selectAll()
      .where('published_at', 'is', null)
      .where('publish_attempt_count', '<', 5)
      .orderBy('created_at', 'asc')
      .limit(batchSize)
      .execute();

    let published = 0;
    for (const row of events) {
      try {
        const event = this.rowToEnvelope(row as unknown as OutboxEvent);
        await this.eventBus.publish(event);
        await this.db
          .updateTable('outbox_events')
          .set({ published_at: new Date() })
          .where('id', '=', row.id)
          .execute();
        published++;
      } catch (err) {
        this.logger.error({
          type: 'OUTBOX_PUBLISH_FAILED',
          outboxEventId: row.id,
          error: err instanceof Error ? err.message : String(err),
        });
        await this.db
          .updateTable('outbox_events')
          .set({ publish_attempt_count: (row.publish_attempt_count ?? 0) + 1 })
          .where('id', '=', row.id)
          .execute();
      }
    }
    return published;
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
    return {
      eventId: row.id as unknown as Uuid,
      eventName: row.event_name,
      eventSchemaVersion: 1,
      tenantId: row.tenant_id as unknown as Uuid,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id as unknown as Uuid,
      payload: row.payload,
      metadata: row.metadata as HrEventEnvelope<unknown>['metadata'],
      privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
      occurredAt: row.created_at,
      version: 1,
    };
  }
}
