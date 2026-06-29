import { Injectable } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';
import type { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance, getCurrentTransaction } from '@hcm/database';

export interface TransitionLedgerEntry {
  id: Uuid;
  tenantId: Uuid;
  aggregateType: string;
  aggregateId: Uuid;
  fromState: string;
  toState: string;
  action: string;
  triggeredBy: string;
  occurredAt: Date;
  correlationId: Uuid;
  decisionRecordId?: Uuid;
  commandId: Uuid;
}

/**
 * Pure row -> entry mapper (exported for unit testing). commandId reads from the
 * command_id column, NOT id — they are distinct (id is the ledger row's own PK).
 */
export function mapTransitionLedgerRow(r: Record<string, unknown>): TransitionLedgerEntry {
  return {
    id: (r.id as string) as unknown as Uuid,
    tenantId: (r.tenant_id as string) as unknown as Uuid,
    aggregateType: r.aggregate_type as string,
    aggregateId: (r.aggregate_id as string) as unknown as Uuid,
    fromState: r.from_state as string,
    toState: r.to_state as string,
    action: r.action as string,
    triggeredBy: r.triggered_by as string,
    occurredAt: r.occurred_at as Date,
    correlationId: (r.correlation_id as string) as unknown as Uuid,
    decisionRecordId: r.decision_record_id
      ? ((r.decision_record_id as string) as unknown as Uuid)
      : undefined,
    commandId: (r.command_id as string) as unknown as Uuid,
  };
}

@Injectable()
export class TransitionLedgerService {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  private get executor(): Kysely<Database> | Transaction<Database> {
    return getCurrentTransaction() ?? this.db;
  }

  async recordTransition(entry: TransitionLedgerEntry): Promise<void> {
    await this.executor
      .insertInto('transition_ledgers')
      .values({
        id: entry.id.value,
        tenant_id: entry.tenantId.value,
        aggregate_type: entry.aggregateType,
        aggregate_id: entry.aggregateId.value,
        from_state: entry.fromState,
        to_state: entry.toState,
        action: entry.action,
        triggered_by: entry.triggeredBy,
        occurred_at: entry.occurredAt,
        correlation_id: entry.correlationId.value,
        decision_record_id: entry.decisionRecordId?.value ?? null,
        command_id: entry.commandId.value,
      })
      .execute();
  }

  async getTransitions(
    aggregateType: string,
    aggregateId: Uuid,
  ): Promise<TransitionLedgerEntry[]> {
    const rows = await this.executor
      .selectFrom('transition_ledgers')
      .selectAll()
      .where('aggregate_type', '=', aggregateType)
      .where('aggregate_id', '=', aggregateId.value)
      .orderBy('occurred_at', 'asc')
      .execute();

    return rows.map((r) => this.toEntry(r as Record<string, unknown>));
  }

  async getLastTransition(
    aggregateType: string,
    aggregateId: Uuid,
  ): Promise<TransitionLedgerEntry | undefined> {
    const row = await this.executor
      .selectFrom('transition_ledgers')
      .selectAll()
      .where('aggregate_type', '=', aggregateType)
      .where('aggregate_id', '=', aggregateId.value)
      .orderBy('occurred_at', 'desc')
      .limit(1)
      .executeTakeFirst();

    return row ? this.toEntry(row as Record<string, unknown>) : undefined;
  }

  private toEntry(r: Record<string, unknown>): TransitionLedgerEntry {
    return mapTransitionLedgerRow(r);
  }
}
