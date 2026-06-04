import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import type { Kysely } from 'kysely';
import { DeadLetterOperationsService } from './dead-letter-operations.service.js';

type InboxRow = Record<string, unknown> & {
  id: string;
  tenant_id: string;
  consumer_name: string;
  consumer_version: string;
  source_event_id: string;
  event_name: string;
  aggregate_type: string;
  aggregate_id: string;
  processing_status: string;
  retry_count: number;
  next_retry_at: Date | null;
  error_summary: string | null;
  processed_at: Date | null;
  created_at: Date;
};

type OutboxRow = Record<string, unknown> & {
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
};

class FakeDeadLetterDb {
  inboxRows: InboxRow[] = [];
  outboxRows: OutboxRow[] = [];
  auditRows: Record<string, unknown>[] = [];

  selectFrom(table: 'inbox_events' | 'outbox_events') {
    return new SelectBuilder(this, table);
  }

  updateTable(table: 'inbox_events' | 'outbox_events') {
    return new UpdateBuilder(this, table);
  }

  insertInto(table: 'audit_log') {
    return new InsertBuilder(this, table);
  }
}

class SelectBuilder {
  private predicates: Array<[string, string, unknown]> = [];
  private limitCount: number | undefined;

  constructor(
    private readonly db: FakeDeadLetterDb,
    private readonly table: 'inbox_events' | 'outbox_events',
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
    const rows = this.table === 'inbox_events' ? this.db.inboxRows : this.db.outboxRows;
    const filtered = rows.filter((row) => this.predicates.every(([column, operator, value]) => {
      if (operator === '=') return row[column] === value;
      if (operator === '<') return Number(row[column]) < Number(value);
      if (operator === '>=') return Number(row[column]) >= Number(value);
      if (operator === 'is') return row[column] === value;
      if (operator === 'is not') return row[column] !== value;
      return false;
    }));
    return typeof this.limitCount === 'number' ? filtered.slice(0, this.limitCount) : filtered;
  }
}

class UpdateBuilder {
  private patch: Record<string, unknown> = {};
  private predicates: Array<[string, unknown]> = [];

  constructor(
    private readonly db: FakeDeadLetterDb,
    private readonly table: 'inbox_events' | 'outbox_events',
  ) {}

  set(patch: Record<string, unknown>) {
    this.patch = patch;
    return this;
  }

  where(column: string, _operator: string, value: unknown) {
    this.predicates.push([column, value]);
    return this;
  }

  async execute() {
    const rows = this.table === 'inbox_events' ? this.db.inboxRows : this.db.outboxRows;
    for (const row of rows) {
      if (this.predicates.every(([column, value]) => row[column] === value)) {
        Object.assign(row, this.patch);
      }
    }
    return [];
  }
}

class InsertBuilder {
  private row: Record<string, unknown> | undefined;

  constructor(
    private readonly db: FakeDeadLetterDb,
    private readonly table: 'audit_log',
  ) {}

  values(row: Record<string, unknown>) {
    this.row = row;
    return this;
  }

  async execute() {
    if (this.table === 'audit_log' && this.row) {
      this.db.auditRows.push(this.row);
    }
    return [];
  }
}

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actor = { actorId: '00000000-0000-0000-0000-000000000101', actorName: 'admin@example.com' };

function serviceWith(db: FakeDeadLetterDb) {
  return serviceBundleWith(db).service;
}

function serviceBundleWith(db: FakeDeadLetterDb) {
  const inboxConsumer = {
    replayDueRetryableEvents: vi.fn().mockResolvedValue(1),
    replayInboxEvent: vi.fn().mockResolvedValue(1),
  };
  const outboxPublisher = {
    pollAndPublish: vi.fn().mockResolvedValue(1),
    publishOutboxEvent: vi.fn().mockResolvedValue(1),
  };
  const service = new DeadLetterOperationsService(
    inboxConsumer as never,
    outboxPublisher as never,
    db as unknown as Kysely<Database>,
  );
  return { service, inboxConsumer, outboxPublisher };
}

function inboxRow(overrides: Partial<InboxRow> = {}): InboxRow {
  return {
    id: '00000000-0000-0000-0000-000000000201',
    tenant_id: tenantId.value,
    consumer_name: 'platform-notifications',
    consumer_version: '1',
    source_event_id: '00000000-0000-0000-0000-000000000301',
    source_topic: 'hr.events.v1',
    source_partition: 0,
    source_offset: 0,
    event_name: 'AbsenceRequestSubmitted',
    aggregate_type: 'AbsenceRequest',
    aggregate_id: '00000000-0000-0000-0000-000000000401',
    processing_status: 'FAILED_NON_RETRYABLE',
    retry_count: 3,
    next_retry_at: null,
    error_summary: 'schema changed',
    processed_at: null,
    created_at: new Date('2026-06-03T08:00:00.000Z'),
    ...overrides,
  };
}

function outboxRow(overrides: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: '00000000-0000-0000-0000-000000000301',
    tenant_id: tenantId.value,
    event_name: 'AbsenceRequestSubmitted',
    aggregate_type: 'AbsenceRequest',
    aggregate_id: '00000000-0000-0000-0000-000000000401',
    payload: { workerId: '00000000-0000-0000-0000-000000000501' },
    metadata: { correlationId: '00000000-0000-0000-0000-000000000601' },
    correlation_id: '00000000-0000-0000-0000-000000000601',
    causation_id: null,
    created_at: new Date('2026-06-03T08:00:00.000Z'),
    published_at: null,
    publish_attempt_count: 5,
    ...overrides,
  };
}

describe('DeadLetterOperationsService', () => {
  it('queues failed inbox rows for replay instead of leaving them in progress', async () => {
    const db = new FakeDeadLetterDb();
    db.inboxRows.push(inboxRow());
    const { service, inboxConsumer } = serviceBundleWith(db);

    const result = await service.retryInboxEvent(tenantId, db.inboxRows[0].id, actor, 'handler fixed');

    expect(result).toEqual(expect.objectContaining({ action: 'RETRY_INBOX_EVENT', replayed: 1 }));
    expect(inboxConsumer.replayInboxEvent).toHaveBeenCalledWith(tenantId, db.inboxRows[0].id);
    expect(inboxConsumer.replayDueRetryableEvents).not.toHaveBeenCalled();
    expect(db.auditRows[0]).toEqual(expect.objectContaining({
      action: 'RETRY_INBOX_EVENT',
      resource_type: 'platform.inbox_events',
      resource_id: db.inboxRows[0].id,
    }));
    expect(db.inboxRows[0]).toEqual(expect.objectContaining({
      processing_status: 'FAILED_RETRYABLE',
      retry_count: 0,
      processed_at: null,
      next_retry_at: expect.any(Date),
      error_summary: expect.stringContaining('Operator queued retry'),
    }));
  });

  it('skips inbox rows with a visible operator reason', async () => {
    const db = new FakeDeadLetterDb();
    db.inboxRows.push(inboxRow({ processing_status: 'FAILED_RETRYABLE' }));
    const service = serviceWith(db);

    const result = await service.skipInboxEvent(tenantId, db.inboxRows[0].id, actor, 'legacy event cannot be replayed');

    expect(result).toEqual(expect.objectContaining({ action: 'SKIP_INBOX_EVENT' }));
    expect(db.auditRows[0]).toEqual(expect.objectContaining({
      action: 'SKIP_INBOX_EVENT',
      resource_type: 'platform.inbox_events',
      resource_id: db.inboxRows[0].id,
    }));
    expect(db.inboxRows[0]).toEqual(expect.objectContaining({
      processing_status: 'SKIPPED',
      processed_at: expect.any(Date),
      next_retry_at: null,
      error_summary: expect.stringContaining('legacy event cannot be replayed'),
    }));
  });

  it('resets exhausted outbox rows for publishing and records operator evidence', async () => {
    const db = new FakeDeadLetterDb();
    db.outboxRows.push(outboxRow({ publish_attempt_count: 5 }));
    const { service, outboxPublisher } = serviceBundleWith(db);

    const result = await service.retryOutboxEvent(tenantId, db.outboxRows[0].id, actor, 'adapter recovered');

    expect(result).toEqual(expect.objectContaining({ action: 'RETRY_OUTBOX_EVENT', published: 1 }));
    expect(outboxPublisher.publishOutboxEvent).toHaveBeenCalledWith(tenantId, db.outboxRows[0].id);
    expect(outboxPublisher.pollAndPublish).not.toHaveBeenCalled();
    expect(db.auditRows[0]).toEqual(expect.objectContaining({
      action: 'RETRY_OUTBOX_EVENT',
      resource_type: 'platform.outbox_events',
      resource_id: db.outboxRows[0].id,
    }));
    expect(db.outboxRows[0]).toEqual(expect.objectContaining({
      published_at: null,
      publish_attempt_count: 0,
      metadata: expect.objectContaining({
        deadLetterOperator: expect.objectContaining({
          action: 'RETRY',
          actorId: actor.actorId,
          reason: 'adapter recovered',
        }),
      }),
    }));
  });

  it('operator-skips outbox rows by removing them from publisher eligibility', async () => {
    const db = new FakeDeadLetterDb();
    db.outboxRows.push(outboxRow({ publish_attempt_count: 3 }));
    const service = serviceWith(db);

    const result = await service.skipOutboxEvent(tenantId, db.outboxRows[0].id, actor, 'poison event');

    expect(result).toEqual(expect.objectContaining({ action: 'SKIP_OUTBOX_EVENT' }));
    expect(db.auditRows[0]).toEqual(expect.objectContaining({
      action: 'SKIP_OUTBOX_EVENT',
      resource_type: 'platform.outbox_events',
      resource_id: db.outboxRows[0].id,
    }));
    expect(db.outboxRows[0]).toEqual(expect.objectContaining({
      publish_attempt_count: 5,
      metadata: expect.objectContaining({
        deadLetterOperator: expect.objectContaining({
          action: 'SKIP',
          actorId: actor.actorId,
          reason: 'poison event',
        }),
      }),
    }));
  });

  it('runs bulk commands with per-row success and failure reporting', async () => {
    const db = new FakeDeadLetterDb();
    db.inboxRows.push(inboxRow({
      id: '00000000-0000-0000-0000-000000000202',
      processing_status: 'FAILED_RETRYABLE',
    }));
    const { service, inboxConsumer } = serviceBundleWith(db);

    const result = await service.bulkCommand(
      tenantId,
      'inbox',
      'retry',
      [db.inboxRows[0].id, '00000000-0000-0000-0000-000000000999'],
      actor,
      'consumer handler patched',
    );

    expect(result).toEqual(expect.objectContaining({
      action: 'BULK_RETRY_INBOX_EVENTS',
      requested: 2,
      succeeded: 1,
      failed: [expect.objectContaining({ id: '00000000-0000-0000-0000-000000000999' })],
    }));
    expect(result.results).toHaveLength(1);
    expect(inboxConsumer.replayInboxEvent).toHaveBeenCalledTimes(1);
    expect(db.auditRows).toHaveLength(1);
  });

  it('summarizes and exports tenant-scoped dead-letter operations', async () => {
    const db = new FakeDeadLetterDb();
    db.inboxRows.push(inboxRow({ error_summary: '=malicious spreadsheet formula' }));
    db.outboxRows.push(outboxRow({ publish_attempt_count: 5 }));
    const service = serviceWith(db);

    const summary = await service.getSummary(tenantId);
    const csv = await service.exportCsv(tenantId);
    const filteredCsv = await service.exportCsv(tenantId, { queue: 'outbox', status: 'EXHAUSTED' }, actor);

    expect(summary.inbox.failedNonRetryable).toBe(1);
    expect(summary.outbox.exhausted).toBe(1);
    expect(csv).toContain('"queue","id","status","eventName"');
    expect(csv).toContain("'\u003dmalicious spreadsheet formula");
    expect(csv).toContain('"outbox","00000000-0000-0000-0000-000000000301","EXHAUSTED"');
    expect(filteredCsv).not.toContain('"inbox"');
    expect(filteredCsv).toContain('"outbox","00000000-0000-0000-0000-000000000301","EXHAUSTED"');
    expect(db.auditRows.at(-1)).toEqual(expect.objectContaining({ action: 'EXPORT_DEAD_LETTER_EVENTS' }));
  });
});
