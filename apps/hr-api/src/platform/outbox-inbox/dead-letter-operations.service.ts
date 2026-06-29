import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { createSystemKyselyInstance } from '@hcm/database';
import { InboxConsumer } from './inbox-consumer.js';
import { OutboxPublisher } from './outbox-publisher.js';

export type DeadLetterInboxStatus =
  | 'IN_PROGRESS'
  | 'FAILED_RETRYABLE'
  | 'FAILED_NON_RETRYABLE'
  | 'SKIPPED'
  | 'SUCCESS';

export type DeadLetterOutboxStatus =
  | 'PENDING'
  | 'EXHAUSTED'
  | 'PUBLISHED'
  | 'OPERATOR_SKIPPED';

export interface DeadLetterActor {
  actorId: string;
  actorName?: string;
}

export interface DeadLetterListQuery {
  status?: string;
  queue?: 'inbox' | 'outbox' | 'all';
  consumerName?: string;
  eventName?: string;
  aggregateType?: string;
  search?: string;
  limit?: number;
}

export interface DeadLetterCommandResult {
  action: string;
  id: string;
  status: string;
  replayed?: number;
  published?: number;
}

export interface DeadLetterBulkCommandResult {
  action: string;
  queue: 'inbox' | 'outbox';
  command: 'retry' | 'skip';
  requested: number;
  succeeded: number;
  failed: Array<{ id: string; error: string }>;
  results: DeadLetterCommandResult[];
}

export interface DeadLetterInboxEventView {
  queue: 'inbox';
  id: string;
  tenantId: string;
  status: DeadLetterInboxStatus;
  consumerName: string;
  consumerVersion: string;
  sourceEventId: string;
  sourceTopic: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  retryCount: number;
  nextRetryAt: string | null;
  errorSummary: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface DeadLetterOutboxEventView {
  queue: 'outbox';
  id: string;
  tenantId: string;
  status: DeadLetterOutboxStatus;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string | null;
  causationId: string | null;
  publishAttemptCount: number;
  publishedAt: string | null;
  createdAt: string;
  errorSummary: string | null;
  metadata: unknown;
  payload: unknown;
  operatorAction: unknown | null;
}

export interface DeadLetterSummary {
  generatedAt: string;
  inbox: {
    failedRetryable: number;
    failedNonRetryable: number;
    inProgress: number;
    skipped: number;
    success: number;
    totalNonSuccess: number;
  };
  outbox: {
    pending: number;
    exhausted: number;
    operatorSkipped: number;
    published: number;
    totalUnresolved: number;
  };
}

type InboxRow = Record<string, unknown> & {
  id: string;
  tenant_id: string;
  consumer_name: string;
  consumer_version: string;
  source_event_id: string;
  source_topic: string;
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
  last_error: string | null;
};

@Injectable()
export class DeadLetterOperationsService {
  private readonly db: Kysely<Database>;

  constructor(
    private readonly inboxConsumer: InboxConsumer,
    private readonly outboxPublisher: OutboxPublisher,
    @Optional() db?: Kysely<Database>,
  ) {
    this.db = db ?? createSystemKyselyInstance();
  }

  async getSummary(tenantId: Uuid): Promise<DeadLetterSummary> {
    const [inboxRows, outboxRows] = await Promise.all([
      this.fetchInboxRows(tenantId),
      this.fetchOutboxRows(tenantId),
    ]);

    const inbox = {
      failedRetryable: inboxRows.filter((row) => row.processing_status === 'FAILED_RETRYABLE').length,
      failedNonRetryable: inboxRows.filter((row) => row.processing_status === 'FAILED_NON_RETRYABLE').length,
      inProgress: inboxRows.filter((row) => row.processing_status === 'IN_PROGRESS').length,
      skipped: inboxRows.filter((row) => row.processing_status === 'SKIPPED').length,
      success: inboxRows.filter((row) => row.processing_status === 'SUCCESS').length,
      totalNonSuccess: inboxRows.filter((row) => row.processing_status !== 'SUCCESS').length,
    };
    const outboxViews = outboxRows.map((row) => this.toOutboxView(row));
    const outbox = {
      pending: outboxViews.filter((row) => row.status === 'PENDING').length,
      exhausted: outboxViews.filter((row) => row.status === 'EXHAUSTED').length,
      operatorSkipped: outboxViews.filter((row) => row.status === 'OPERATOR_SKIPPED').length,
      published: outboxViews.filter((row) => row.status === 'PUBLISHED').length,
      totalUnresolved: outboxViews.filter((row) => row.status !== 'PUBLISHED' && row.status !== 'OPERATOR_SKIPPED').length,
    };

    return {
      generatedAt: new Date().toISOString(),
      inbox,
      outbox,
    };
  }

  async listInboxEvents(tenantId: Uuid, query: DeadLetterListQuery = {}): Promise<DeadLetterInboxEventView[]> {
    const rows = await this.fetchInboxRows(tenantId);
    return rows
      .map((row) => this.toInboxView(row))
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => !query.consumerName || row.consumerName === query.consumerName)
      .filter((row) => !query.eventName || row.eventName === query.eventName)
      .filter((row) => !query.aggregateType || row.aggregateType === query.aggregateType)
      .filter((row) => this.matchesSearch(row, query.search))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, this.limit(query.limit));
  }

  async listOutboxEvents(tenantId: Uuid, query: DeadLetterListQuery = {}): Promise<DeadLetterOutboxEventView[]> {
    const rows = await this.fetchOutboxRows(tenantId);
    return rows
      .map((row) => this.toOutboxView(row))
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => !query.eventName || row.eventName === query.eventName)
      .filter((row) => !query.aggregateType || row.aggregateType === query.aggregateType)
      .filter((row) => this.matchesSearch(row, query.search))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, this.limit(query.limit));
  }

  async retryInboxEvent(
    tenantId: Uuid,
    inboxEventId: string,
    actor: DeadLetterActor,
    reason?: string,
  ): Promise<DeadLetterCommandResult> {
    const row = await this.requireInboxRow(tenantId, inboxEventId);
    if (row.processing_status === 'SUCCESS') {
      throw new BadRequestException('Successful inbox events do not need retry');
    }

    await this.db
      .updateTable('inbox_events')
      .set({
        processing_status: 'FAILED_RETRYABLE',
        retry_count: 0,
        next_retry_at: new Date(),
        processed_at: null,
        error_summary: this.operatorSummary('Operator queued retry', actor, reason),
      })
      .where('id', '=', inboxEventId)
      .execute();

    await this.auditAction(tenantId, actor, 'RETRY_INBOX_EVENT', 'platform.inbox_events', inboxEventId, { reason });
    const replayed = await this.inboxConsumer.replayInboxEvent(tenantId, inboxEventId);
    return {
      action: 'RETRY_INBOX_EVENT',
      id: inboxEventId,
      status: 'FAILED_RETRYABLE',
      replayed,
    };
  }

  async skipInboxEvent(
    tenantId: Uuid,
    inboxEventId: string,
    actor: DeadLetterActor,
    reason: string,
  ): Promise<DeadLetterCommandResult> {
    const normalizedReason = this.requireReason(reason);
    const row = await this.requireInboxRow(tenantId, inboxEventId);
    if (row.processing_status === 'SUCCESS') {
      throw new BadRequestException('Successful inbox events cannot be skipped');
    }

    await this.db
      .updateTable('inbox_events')
      .set({
        processing_status: 'SKIPPED',
        next_retry_at: null,
        processed_at: new Date(),
        error_summary: this.operatorSummary('Operator skipped inbox event', actor, normalizedReason),
      })
      .where('id', '=', inboxEventId)
      .execute();

    await this.auditAction(tenantId, actor, 'SKIP_INBOX_EVENT', 'platform.inbox_events', inboxEventId, {
      reason: normalizedReason,
    });
    return {
      action: 'SKIP_INBOX_EVENT',
      id: inboxEventId,
      status: 'SKIPPED',
    };
  }

  async retryOutboxEvent(
    tenantId: Uuid,
    outboxEventId: string,
    actor: DeadLetterActor,
    reason?: string,
  ): Promise<DeadLetterCommandResult> {
    const row = await this.requireOutboxRow(tenantId, outboxEventId);
    if (row.published_at) {
      throw new BadRequestException('Published outbox events cannot be retried');
    }

    await this.db
      .updateTable('outbox_events')
      .set({
        published_at: null,
        publish_attempt_count: 0,
        last_error: null,
        metadata: this.mergeOperatorMetadata(row.metadata, 'RETRY', actor, reason),
      })
      .where('id', '=', outboxEventId)
      .execute();

    await this.auditAction(tenantId, actor, 'RETRY_OUTBOX_EVENT', 'platform.outbox_events', outboxEventId, { reason });
    const published = await this.outboxPublisher.publishOutboxEvent(tenantId, outboxEventId);
    return {
      action: 'RETRY_OUTBOX_EVENT',
      id: outboxEventId,
      status: 'PENDING',
      published,
    };
  }

  async skipOutboxEvent(
    tenantId: Uuid,
    outboxEventId: string,
    actor: DeadLetterActor,
    reason: string,
  ): Promise<DeadLetterCommandResult> {
    const normalizedReason = this.requireReason(reason);
    const row = await this.requireOutboxRow(tenantId, outboxEventId);
    if (row.published_at) {
      throw new BadRequestException('Published outbox events cannot be skipped');
    }

    await this.db
      .updateTable('outbox_events')
      .set({
        publish_attempt_count: Math.max(Number(row.publish_attempt_count ?? 0), 5),
        metadata: this.mergeOperatorMetadata(row.metadata, 'SKIP', actor, normalizedReason),
      })
      .where('id', '=', outboxEventId)
      .execute();

    await this.auditAction(tenantId, actor, 'SKIP_OUTBOX_EVENT', 'platform.outbox_events', outboxEventId, {
      reason: normalizedReason,
    });
    return {
      action: 'SKIP_OUTBOX_EVENT',
      id: outboxEventId,
      status: 'OPERATOR_SKIPPED',
    };
  }

  async bulkCommand(
    tenantId: Uuid,
    queue: 'inbox' | 'outbox',
    command: 'retry' | 'skip',
    ids: string[],
    actor: DeadLetterActor,
    reason?: string,
  ): Promise<DeadLetterBulkCommandResult> {
    const uniqueIds = Array.from(new Set(ids.map((id) => id?.trim()).filter(Boolean)));
    if (uniqueIds.length === 0) {
      throw new BadRequestException('At least one event id is required');
    }
    if (uniqueIds.length > 100) {
      throw new BadRequestException('Bulk dead-letter operations are limited to 100 events at a time');
    }
    if (command === 'skip') {
      this.requireReason(reason);
    }

    const results: DeadLetterCommandResult[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of uniqueIds) {
      try {
        const result = queue === 'inbox'
          ? command === 'retry'
            ? await this.retryInboxEvent(tenantId, id, actor, reason)
            : await this.skipInboxEvent(tenantId, id, actor, reason ?? '')
          : command === 'retry'
            ? await this.retryOutboxEvent(tenantId, id, actor, reason)
            : await this.skipOutboxEvent(tenantId, id, actor, reason ?? '');
        results.push(result);
      } catch (error) {
        failed.push({
          id,
          error: error instanceof Error ? error.message : 'Unknown dead-letter operation failure',
        });
      }
    }

    return {
      action: `BULK_${command.toUpperCase()}_${queue.toUpperCase()}_EVENTS`,
      queue,
      command,
      requested: uniqueIds.length,
      succeeded: results.length,
      failed,
      results,
    };
  }

  async exportCsv(tenantId: Uuid, query: DeadLetterListQuery = {}, actor?: DeadLetterActor): Promise<string> {
    if (actor) {
      await this.auditAction(tenantId, actor, 'EXPORT_DEAD_LETTER_EVENTS', 'platform.dead_letter_events', tenantId.value, {
        format: 'csv',
        query,
      });
    }
    const exportQuery = { ...query, limit: query.limit ?? 1000 };
    const includeInbox = !query.queue || query.queue === 'all' || query.queue === 'inbox';
    const includeOutbox = !query.queue || query.queue === 'all' || query.queue === 'outbox';
    const [inbox, outbox] = await Promise.all([
      includeInbox ? this.listInboxEvents(tenantId, exportQuery) : Promise.resolve([]),
      includeOutbox ? this.listOutboxEvents(tenantId, exportQuery) : Promise.resolve([]),
    ]);
    const rows = [
      ['queue', 'id', 'status', 'eventName', 'aggregateType', 'aggregateId', 'consumerName', 'retryCount', 'attemptCount', 'createdAt', 'lastError'],
      ...inbox
        .filter((row) => row.status !== 'SUCCESS')
        .map((row) => [
          row.queue,
          row.id,
          row.status,
          row.eventName,
          row.aggregateType,
          row.aggregateId,
          row.consumerName,
          String(row.retryCount),
          '',
          row.createdAt,
          row.errorSummary ?? '',
        ]),
      ...outbox
        .filter((row) => row.status !== 'PUBLISHED')
        .map((row) => [
          row.queue,
          row.id,
          row.status,
          row.eventName,
          row.aggregateType,
          row.aggregateId,
          '',
          '',
          String(row.publishAttemptCount),
          row.createdAt,
          row.errorSummary ?? '',
        ]),
    ];

    return rows.map((row) => row.map(csvCell).join(',')).join('\n');
  }

  private async fetchInboxRows(tenantId: Uuid): Promise<InboxRow[]> {
    const rows = await this.db
      .selectFrom('inbox_events')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows as unknown as InboxRow[];
  }

  private async fetchOutboxRows(tenantId: Uuid): Promise<OutboxRow[]> {
    const rows = await this.db
      .selectFrom('outbox_events')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows as unknown as OutboxRow[];
  }

  private async requireInboxRow(tenantId: Uuid, inboxEventId: string): Promise<InboxRow> {
    const row = await this.db
      .selectFrom('inbox_events')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', inboxEventId)
      .executeTakeFirst();
    if (!row) {
      throw new NotFoundException('Inbox event was not found for this tenant');
    }
    return row as unknown as InboxRow;
  }

  private async requireOutboxRow(tenantId: Uuid, outboxEventId: string): Promise<OutboxRow> {
    const row = await this.db
      .selectFrom('outbox_events')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', outboxEventId)
      .executeTakeFirst();
    if (!row) {
      throw new NotFoundException('Outbox event was not found for this tenant');
    }
    return row as unknown as OutboxRow;
  }

  private toInboxView(row: InboxRow): DeadLetterInboxEventView {
    return {
      queue: 'inbox',
      id: row.id,
      tenantId: row.tenant_id,
      status: row.processing_status as DeadLetterInboxStatus,
      consumerName: row.consumer_name,
      consumerVersion: row.consumer_version,
      sourceEventId: row.source_event_id,
      sourceTopic: row.source_topic,
      eventName: row.event_name,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      retryCount: Number(row.retry_count ?? 0),
      nextRetryAt: dateIso(row.next_retry_at),
      errorSummary: row.error_summary,
      processedAt: dateIso(row.processed_at),
      createdAt: dateIso(row.created_at) ?? new Date(0).toISOString(),
    };
  }

  private toOutboxView(row: OutboxRow): DeadLetterOutboxEventView {
    const operatorAction = this.operatorAction(row.metadata);
    return {
      queue: 'outbox',
      id: row.id,
      tenantId: row.tenant_id,
      status: this.outboxStatus(row),
      eventName: row.event_name,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      correlationId: row.correlation_id,
      causationId: row.causation_id,
      publishAttemptCount: Number(row.publish_attempt_count ?? 0),
      publishedAt: dateIso(row.published_at),
      createdAt: dateIso(row.created_at) ?? new Date(0).toISOString(),
      errorSummary: row.last_error ?? null,
      metadata: row.metadata,
      payload: row.payload,
      operatorAction,
    };
  }

  private outboxStatus(row: OutboxRow): DeadLetterOutboxStatus {
    if (row.published_at) return 'PUBLISHED';
    const operatorAction = this.operatorAction(row.metadata);
    if (operatorAction && typeof operatorAction === 'object' && (operatorAction as { action?: unknown }).action === 'SKIP') {
      return 'OPERATOR_SKIPPED';
    }
    return Number(row.publish_attempt_count ?? 0) >= 5 ? 'EXHAUSTED' : 'PENDING';
  }

  private matchesSearch(row: unknown, search: string | undefined): boolean {
    const needle = search?.trim().toLowerCase();
    if (!needle) return true;
    return JSON.stringify(row).toLowerCase().includes(needle);
  }

  private limit(value: number | undefined): number {
    if (!value || !Number.isFinite(value)) return 50;
    return Math.max(1, Math.min(Math.trunc(value), 200));
  }

  private requireReason(reason: string | undefined): string {
    const normalized = reason?.trim();
    if (!normalized) {
      throw new BadRequestException('A reason is required for skip operations');
    }
    return normalized;
  }

  private operatorSummary(prefix: string, actor: DeadLetterActor, reason?: string): string {
    return [
      prefix,
      `by ${actor.actorName || actor.actorId}`,
      reason ? `reason: ${reason}` : undefined,
    ].filter(Boolean).join(' - ');
  }

  private mergeOperatorMetadata(
    metadata: unknown,
    action: 'RETRY' | 'SKIP',
    actor: DeadLetterActor,
    reason?: string,
  ): Record<string, unknown> {
    const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
    return {
      ...base,
      deadLetterOperator: {
        action,
        actorId: actor.actorId,
        actorName: actor.actorName,
        reason: reason?.trim() || null,
        actedAt: new Date().toISOString(),
      },
    };
  }

  private operatorAction(metadata: unknown): unknown | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    return (metadata as Record<string, unknown>).deadLetterOperator ?? null;
  }

  private async auditAction(
    tenantId: Uuid,
    actor: DeadLetterActor,
    action: string,
    resourceType: string,
    resourceId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .insertInto('audit_log')
      .values({
        id: crypto.randomUUID(),
        tenant_id: tenantId.value,
        actor_type: 'USER',
        actor_id: actor.actorId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        payload: {
          ...payload,
          actorName: actor.actorName,
          operatorConsole: 'dead-letter-events',
        },
        occurred_at: new Date(),
        correlation_id: crypto.randomUUID(),
      })
      .execute();
  }
}

function dateIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}
