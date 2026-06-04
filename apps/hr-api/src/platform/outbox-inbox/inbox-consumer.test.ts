import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import type { Kysely } from 'kysely';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { InboxConsumer } from './inbox-consumer.js';
import type { InboxDeduplicator } from './inbox-deduplicator.js';

type InboxRow = Record<string, unknown> & {
  id: string;
  consumer_name: string;
  consumer_version: string;
  source_event_id: string;
  processing_status: string;
};

class FakeInboxDb {
  rows: InboxRow[] = [];
  outboxRows: Array<{ id: string }> = [];

  selectFrom(table = 'inbox_events') {
    return new SelectBuilder(this, table);
  }

  insertInto() {
    return new InsertBuilder(this);
  }

  updateTable() {
    return new UpdateBuilder(this);
  }
}

class SelectBuilder {
  private predicates: Array<[string, string, unknown]> = [];
  private limitCount: number | undefined;

  constructor(
    private readonly db: FakeInboxDb,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }

  selectAll() {
    return this;
  }

  where(column: string, operator: string, value: unknown) {
    this.predicates.push([column, operator, value]);
    return this;
  }

  orderBy() {
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  async executeTakeFirst() {
    return this.findRows()[0];
  }

  async execute() {
    return this.findRows();
  }

  private findRows() {
    const rows = this.table === 'outbox_events' ? this.db.outboxRows : this.db.rows;
    const filtered = rows.filter((row) => this.predicates.every(([column, operator, value]) => {
      if (operator === '<') {
        return new Date(row[column] as string | Date).getTime() < new Date(value as string | Date).getTime();
      }
      return row[column] === value;
    }));
    return typeof this.limitCount === 'number' ? filtered.slice(0, this.limitCount) : filtered;
  }
}

class InsertBuilder {
  private row?: InboxRow;

  constructor(private readonly db: FakeInboxDb) {}

  values(row: InboxRow) {
    this.row = row;
    return this;
  }

  async execute() {
    if (!this.row) return [];
    this.db.rows.push(this.row);
    return [];
  }
}

class UpdateBuilder {
  private patch: Record<string, unknown> = {};
  private predicates: Array<[string, unknown]> = [];

  constructor(private readonly db: FakeInboxDb) {}

  set(patch: Record<string, unknown>) {
    this.patch = patch;
    return this;
  }

  where(column: string, _operator: string, value: unknown) {
    this.predicates.push([column, value]);
    return this;
  }

  async execute() {
    for (const row of this.db.rows) {
      if (this.predicates.every(([column, value]) => row[column] === value)) {
        Object.assign(row, this.patch);
      }
    }
    return [];
  }
}

function event(): HrEventEnvelope<Record<string, never>> {
  return {
    eventId: Uuid.generate(),
    eventName: 'AbsenceRequestSubmitted',
    eventSchemaVersion: 1,
    tenantId: new Uuid('00000000-0000-0000-0000-000000000001'),
    aggregateType: 'AbsenceRequest',
    aggregateId: Uuid.generate(),
    payload: {},
    metadata: {
      correlationId: Uuid.generate(),
      requestHash: 'inbox-consumer-test',
      clientType: 'SYSTEM',
    },
    privacy: {
      piiClassification: 'LOW',
      employeeDataCategory: 'PROFILE',
      subjectWorkerId: Uuid.generate().value,
      managerVisible: true,
      employeeVisible: true,
      hrRestricted: false,
      redactionApplied: false,
    },
    occurredAt: new Date(),
    version: 1,
  };
}

function deduplicator(processed = false) {
  return {
    isProcessed: vi.fn().mockResolvedValue(processed),
  } as unknown as InboxDeduplicator;
}

describe('InboxConsumer', () => {
  it('marks a new event as success using the inserted inbox id', async () => {
    const db = new FakeInboxDb();
    const consumer = new InboxConsumer(deduplicator(), db as unknown as Kysely<Database>);
    const envelope = event();

    await consumer.consume(envelope, 'platform-notifications', '1', { handle: vi.fn().mockResolvedValue(undefined) });

    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].id).toEqual(expect.any(String));
    expect(db.rows[0].processing_status).toBe('SUCCESS');
    expect(db.rows[0].processed_at).toBeInstanceOf(Date);
  });

  it('recovers an existing in-progress inbox row instead of inserting a duplicate', async () => {
    const db = new FakeInboxDb();
    const envelope = event();
    db.rows.push({
      id: Uuid.generate().value,
      consumer_name: 'platform-notifications',
      consumer_version: '1',
      source_event_id: envelope.eventId.value,
      processing_status: 'IN_PROGRESS',
    });
    const consumer = new InboxConsumer(deduplicator(), db as unknown as Kysely<Database>);

    await consumer.consume(envelope, 'platform-notifications', '1', { handle: vi.fn().mockResolvedValue(undefined) });

    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].processing_status).toBe('SUCCESS');
  });

  it('marks in-progress notification inbox rows with no outbox source as skipped', async () => {
    const db = new FakeInboxDb();
    const orphanedId = Uuid.generate().value;
    const replayableId = Uuid.generate().value;
    const processedId = Uuid.generate().value;
    db.rows.push(
      {
        id: orphanedId,
        consumer_name: 'platform-notifications',
        consumer_version: '1',
        source_event_id: Uuid.generate().value,
        processing_status: 'IN_PROGRESS',
      },
      {
        id: replayableId,
        consumer_name: 'platform-notifications',
        consumer_version: '1',
        source_event_id: '00000000-0000-0000-0000-000000000201',
        processing_status: 'IN_PROGRESS',
      },
      {
        id: processedId,
        consumer_name: 'platform-notifications',
        consumer_version: '1',
        source_event_id: Uuid.generate().value,
        processing_status: 'SUCCESS',
      },
    );
    db.outboxRows.push({ id: '00000000-0000-0000-0000-000000000201' });
    const consumer = new InboxConsumer(deduplicator(), db as unknown as Kysely<Database>);

    const skipped = await consumer.skipOrphanedEventsWithoutOutbox('platform-notifications', '1');

    expect(skipped).toBe(1);
    expect(db.rows.find((row) => row.id === orphanedId)).toEqual(expect.objectContaining({
      processing_status: 'SKIPPED',
      error_summary: 'Legacy inbox event has no matching outbox event and cannot be replayed.',
      processed_at: expect.any(Date),
    }));
    expect(db.rows.find((row) => row.id === replayableId)?.processing_status).toBe('IN_PROGRESS');
    expect(db.rows.find((row) => row.id === processedId)?.processing_status).toBe('SUCCESS');
  });

  it('recovers stale in-progress inbox rows without touching fresh processing rows', async () => {
    const db = new FakeInboxDb();
    const replayableId = Uuid.generate().value;
    const orphanedId = Uuid.generate().value;
    const freshId = Uuid.generate().value;
    const outboxEventId = '00000000-0000-0000-0000-000000000301';
    const staleCreatedAt = new Date('2026-06-03T10:00:00.000Z');
    const freshCreatedAt = new Date('2026-06-03T11:59:00.000Z');
    db.rows.push(
      {
        id: replayableId,
        consumer_name: 'reporting-warehouse-export',
        consumer_version: '1',
        source_event_id: outboxEventId,
        processing_status: 'IN_PROGRESS',
        retry_count: 2,
        created_at: staleCreatedAt,
      },
      {
        id: orphanedId,
        consumer_name: 'iam-provisioning-saga',
        consumer_version: '1',
        source_event_id: Uuid.generate().value,
        processing_status: 'IN_PROGRESS',
        retry_count: 0,
        created_at: staleCreatedAt,
      },
      {
        id: freshId,
        consumer_name: 'reporting-warehouse-export',
        consumer_version: '1',
        source_event_id: Uuid.generate().value,
        processing_status: 'IN_PROGRESS',
        retry_count: 0,
        created_at: freshCreatedAt,
      },
    );
    db.outboxRows.push({ id: outboxEventId });
    const consumer = new InboxConsumer(deduplicator(), db as unknown as Kysely<Database>);

    const recovered = await consumer.recoverStaleInProgressEvents(new Date('2026-06-03T11:00:00.000Z'));

    expect(recovered).toEqual({ retryable: 1, skipped: 1 });
    expect(db.rows.find((row) => row.id === replayableId)).toEqual(expect.objectContaining({
      processing_status: 'FAILED_RETRYABLE',
      retry_count: 3,
      error_summary: 'Recovered stale in-progress inbox event after process interruption.',
      next_retry_at: expect.any(Date),
    }));
    expect(db.rows.find((row) => row.id === orphanedId)).toEqual(expect.objectContaining({
      processing_status: 'SKIPPED',
      error_summary: 'Stale inbox event has no matching outbox event and cannot be replayed.',
      processed_at: expect.any(Date),
    }));
    expect(db.rows.find((row) => row.id === freshId)?.processing_status).toBe('IN_PROGRESS');
  });

  it('replays due retryable inbox rows through registered consumer handlers', async () => {
    const db = new FakeInboxDb();
    const envelope = event();
    db.rows.push({
      id: Uuid.generate().value,
      consumer_name: 'platform-notifications',
      consumer_version: '1',
      source_event_id: envelope.eventId.value,
      processing_status: 'FAILED_RETRYABLE',
      retry_count: 1,
      next_retry_at: new Date('2026-06-03T10:00:00.000Z'),
      event_name: envelope.eventName,
      aggregate_type: envelope.aggregateType,
      aggregate_id: envelope.aggregateId.value,
      tenant_id: envelope.tenantId.value,
      source_topic: 'hr.absence.v1',
      source_partition: 0,
      source_offset: 0,
      error_summary: 'temporary failure',
      processed_at: null,
      created_at: new Date('2026-06-03T09:59:00.000Z'),
    });
    db.outboxRows.push({
      id: envelope.eventId.value,
      tenant_id: envelope.tenantId.value,
      event_name: envelope.eventName,
      aggregate_type: envelope.aggregateType,
      aggregate_id: envelope.aggregateId.value,
      payload: envelope.payload,
      metadata: {
        ...envelope.metadata,
        privacy: envelope.privacy,
      },
      correlation_id: envelope.metadata.correlationId.value,
      causation_id: null,
      created_at: envelope.occurredAt,
      published_at: envelope.occurredAt,
      publish_attempt_count: 0,
    });
    const consumer = new InboxConsumer(deduplicator(), db as unknown as Kysely<Database>);
    const handler = vi.fn().mockResolvedValue(undefined);
    consumer.registerReplayHandler('platform-notifications', '1', { handle: handler });

    const replayed = await consumer.replayDueRetryableEvents(new Date('2026-06-03T11:00:00.000Z'));

    expect(replayed).toBe(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      eventId: expect.objectContaining({ value: envelope.eventId.value }),
      eventName: envelope.eventName,
      aggregateType: envelope.aggregateType,
    }));
    expect(db.rows[0]).toEqual(expect.objectContaining({
      processing_status: 'SUCCESS',
      processed_at: expect.any(Date),
    }));
  });
});
