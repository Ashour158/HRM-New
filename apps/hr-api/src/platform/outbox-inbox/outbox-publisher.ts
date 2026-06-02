import { Injectable, Logger } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import type { ClientType, EventMetadata, HrEventEnvelope } from '@hcm/event-schemas';
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
          published++;
        } catch (err) {
          this.logger.error({
            type: 'OUTBOX_PUBLISH_FAILED',
            outboxEventId: row.id,
            error: err instanceof Error ? err.message : String(err),
          });
          await trx
            .updateTable('outbox_events')
            .set({ publish_attempt_count: (row.publish_attempt_count ?? 0) + 1 })
            .where('id', '=', row.id)
            .execute();
        }
      }
      return published;
    });
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
      eventId: new Uuid(row.id),
      eventName: row.event_name,
      eventSchemaVersion: 1,
      tenantId: new Uuid(row.tenant_id),
      aggregateType: row.aggregate_type,
      aggregateId: new Uuid(row.aggregate_id),
      payload: row.payload,
      metadata: this.normalizeMetadata(row),
      privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
      occurredAt: row.created_at,
      version: 1,
    };
  }

  private normalizeMetadata(row: OutboxEvent): EventMetadata {
    const stored = isRecord(row.metadata) ? row.metadata : {};
    const correlationId = this.uuidFrom(stored.correlationId) ?? this.uuidFrom(row.correlation_id) ?? new Uuid(row.id);
    const causationId = this.uuidFrom(stored.causationId) ?? this.uuidFrom(row.causation_id);
    const clientType = isClientType(stored.clientType) ? stored.clientType : 'SYSTEM';
    const requestHash = typeof stored.requestHash === 'string' && stored.requestHash.length > 0
      ? stored.requestHash
      : row.id;

    return {
      correlationId,
      causationId,
      sourceEventId: this.uuidFrom(stored.sourceEventId),
      processInstanceId: typeof stored.processInstanceId === 'string' ? stored.processInstanceId : undefined,
      requestHash,
      clientType,
      dataResidencyRegion: typeof stored.dataResidencyRegion === 'string' ? stored.dataResidencyRegion : undefined,
      hrDataSensitivity: isHrDataSensitivity(stored.hrDataSensitivity) ? stored.hrDataSensitivity : undefined,
    };
  }

  private uuidFrom(value: unknown): Uuid | undefined {
    if (value instanceof Uuid) {
      return value;
    }
    if (typeof value === 'string' && Uuid.isValid(value)) {
      return new Uuid(value);
    }
    if (isRecord(value) && typeof value.value === 'string' && Uuid.isValid(value.value)) {
      return new Uuid(value.value);
    }
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isClientType(value: unknown): value is ClientType {
  return typeof value === 'string' && [
    'EMPLOYEE_PORTAL',
    'MANAGER_PORTAL',
    'HR_ADMIN',
    'MOBILE',
    'BFF',
    'SYSTEM',
    'INTEGRATION',
  ].includes(value);
}

function isHrDataSensitivity(
  value: unknown,
): value is NonNullable<EventMetadata['hrDataSensitivity']> {
  return typeof value === 'string' && [
    'LOW',
    'MEDIUM',
    'HIGH',
    'RESTRICTED',
    'SPECIAL_CATEGORY',
  ].includes(value);
}
