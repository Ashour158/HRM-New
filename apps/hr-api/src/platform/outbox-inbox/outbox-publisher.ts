import { Injectable, Logger } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import type { ClientType, EventMetadata, HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
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
        metadata: {
          ...event.metadata,
          privacy: event.privacy,
        } as unknown as Record<string, never>,
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
    const metadata = this.normalizeMetadata(row);
    return {
      eventId: new Uuid(row.id),
      eventName: row.event_name,
      eventSchemaVersion: 1,
      tenantId: new Uuid(row.tenant_id),
      aggregateType: row.aggregate_type,
      aggregateId: new Uuid(row.aggregate_id),
      payload: row.payload,
      metadata,
      privacy: this.normalizePrivacy(row, metadata),
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

    const metadata: EventMetadata = {
      correlationId,
      causationId,
      sourceEventId: this.uuidFrom(stored.sourceEventId),
      processInstanceId: typeof stored.processInstanceId === 'string' ? stored.processInstanceId : undefined,
      requestHash,
      clientType,
      dataResidencyRegion: typeof stored.dataResidencyRegion === 'string' ? stored.dataResidencyRegion : undefined,
      hrDataSensitivity: isHrDataSensitivity(stored.hrDataSensitivity) ? stored.hrDataSensitivity : undefined,
    };
    return {
      ...metadata,
      sourceOutboxEventId: row.id,
      publicationSource: 'OUTBOX',
    } as EventMetadata;
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

  private normalizePrivacy(row: OutboxEvent, metadata: EventMetadata): HrEventPrivacy {
    const stored = isRecord(row.metadata) ? row.metadata : {};
    if (isHrEventPrivacy(stored.privacy)) {
      return stored.privacy;
    }

    const classification = metadata.hrDataSensitivity ?? 'NONE';
    return createPrivacyForEvent(
      classification,
      this.extractWorkerId(row.payload),
      inferEmployeeDataCategory(row.aggregate_type),
    );
  }

  private extractWorkerId(value: unknown): string | undefined {
    if (!isRecord(value) && !Array.isArray(value)) return undefined;
    const preferredKeys = ['subjectWorkerId', 'workerId', 'employeeId', 'recipientWorkerId'];
    const queue = Array.isArray(value) ? [...value] : [value];
    while (queue.length > 0) {
      const current = queue.shift();
      if (Array.isArray(current)) {
        queue.push(...current);
        continue;
      }
      if (!isRecord(current)) continue;
      for (const key of preferredKeys) {
        const candidate = this.readUuidLike(current[key]);
        if (candidate) return candidate;
      }
      queue.push(...Object.values(current));
    }
    return undefined;
  }

  private readUuidLike(value: unknown): string | undefined {
    if (value instanceof Uuid) return value.value;
    if (typeof value === 'string' && Uuid.isValid(value)) return value;
    if (isRecord(value) && typeof value.value === 'string' && Uuid.isValid(value.value)) return value.value;
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

function isHrEventPrivacy(value: unknown): value is HrEventPrivacy {
  if (!isRecord(value)) return false;
  return (
    isPrivacyClassification(value.piiClassification) &&
    (value.subjectWorkerId === undefined || (typeof value.subjectWorkerId === 'string' && Uuid.isValid(value.subjectWorkerId))) &&
    typeof value.managerVisible === 'boolean' &&
    typeof value.employeeVisible === 'boolean' &&
    typeof value.hrRestricted === 'boolean' &&
    typeof value.redactionApplied === 'boolean'
  );
}

function isPrivacyClassification(value: unknown): value is HrEventPrivacy['piiClassification'] {
  return typeof value === 'string' && [
    'NONE',
    'LOW',
    'MEDIUM',
    'HIGH',
    'RESTRICTED',
    'SPECIAL_CATEGORY',
  ].includes(value);
}

function inferEmployeeDataCategory(aggregateType: string): HrEventPrivacy['employeeDataCategory'] {
  const value = aggregateType.toLowerCase();
  if (value.includes('payroll') || value.includes('payslip')) return 'PAYROLL';
  if (value.includes('compensation') || value.includes('bonus') || value.includes('equity')) return 'COMPENSATION';
  if (value.includes('benefits')) return 'BENEFITS';
  if (value.includes('performance') || value.includes('objective') || value.includes('goal')) return 'PERFORMANCE';
  if (value.includes('relations') || value.includes('disciplinary') || value.includes('grievance')) return 'ER_CASE';
  if (value.includes('medical') || value.includes('wellness') || value.includes('eap')) return 'MEDICAL';
  if (value.includes('authorization') || value.includes('visa') || value.includes('immigration')) return 'IMMIGRATION';
  if (value.includes('survey')) return 'SURVEY';
  return 'PROFILE';
}
