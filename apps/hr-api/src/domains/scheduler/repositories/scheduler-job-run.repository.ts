import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import type { Kysely, Selectable, Updateable } from 'kysely';
import type { SchedulerJobRun, SchedulerJobRunRepositoryPort, SchedulerJobRunStatus, SchedulerJobType } from '../scheduler.types.js';

type SchedulerJobRunTable = Database['hr_scheduler.scheduler_job_runs'];
type SchedulerJobRunRow = Selectable<SchedulerJobRunTable>;

@Injectable()
export class SchedulerJobRunRepository implements SchedulerJobRunRepositoryPort {
  private readonly db: Kysely<Database>;
  private readonly tableName = 'hr_scheduler.scheduler_job_runs' as const;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async tryStartRun(input: {
    tenantId: Uuid;
    jobId: Uuid;
    jobKey: string;
    periodKey: string;
    runKind: SchedulerJobType;
    idempotencyKey: string;
    correlationId: Uuid;
    startedAt: Date;
  }): Promise<{ started: boolean; run: SchedulerJobRun }> {
    const row = {
      id: Uuid.generate().value,
      tenant_id: input.tenantId.value,
      job_id: input.jobId.value,
      job_key: input.jobKey,
      period_key: input.periodKey,
      run_kind: input.runKind,
      status: 'STARTED',
      idempotency_key: input.idempotencyKey,
      correlation_id: input.correlationId.value,
      started_at: input.startedAt,
      result_payload: {},
      aggregate_version: 0,
      created_at: input.startedAt,
      updated_at: input.startedAt,
    };
    const inserted = await this.db
      .insertInto(this.tableName)
      .values(row as never)
      .onConflict((oc) => oc.columns(['tenant_id', 'job_key', 'period_key']).doNothing())
      .returningAll()
      .executeTakeFirst();

    if (inserted) {
      return { started: true, run: this.toAggregate(inserted) };
    }

    const existing = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', input.tenantId.value)
      .where('job_key', '=', input.jobKey)
      .where('period_key', '=', input.periodKey)
      .executeTakeFirstOrThrow();
    return { started: false, run: this.toAggregate(existing) };
  }

  async markSucceeded(input: {
    tenantId: Uuid;
    runId: Uuid;
    commandId?: Uuid;
    eventId?: Uuid;
    resultPayload: Record<string, unknown>;
    finishedAt?: Date;
  }): Promise<void> {
    await this.updateRun(input.tenantId, input.runId, {
      status: 'SUCCEEDED',
      command_id: input.commandId?.value ?? null,
      event_id: input.eventId?.value ?? null,
      finished_at: input.finishedAt ?? new Date(),
      result_payload: input.resultPayload,
      updated_at: new Date().toISOString(),
    });
  }

  async markFailed(input: {
    tenantId: Uuid;
    runId: Uuid;
    errorMessage: string;
    resultPayload?: Record<string, unknown>;
    finishedAt?: Date;
  }): Promise<void> {
    await this.updateRun(input.tenantId, input.runId, {
      status: 'FAILED',
      error_message: input.errorMessage,
      finished_at: input.finishedAt ?? new Date(),
      result_payload: input.resultPayload ?? {},
      updated_at: new Date().toISOString(),
    });
  }

  private async updateRun(tenantId: Uuid, runId: Uuid, patch: Updateable<SchedulerJobRunTable>): Promise<void> {
    await this.db
      .updateTable(this.tableName)
      .set(patch)
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', runId.value)
      .execute();
  }

  private toAggregate(row: SchedulerJobRunRow): SchedulerJobRun {
    return {
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      jobId: new Uuid(row.job_id),
      jobKey: row.job_key,
      periodKey: row.period_key,
      runKind: row.run_kind as SchedulerJobType,
      status: row.status as SchedulerJobRunStatus,
      idempotencyKey: row.idempotency_key,
      commandId: row.command_id ? new Uuid(row.command_id) : undefined,
      correlationId: new Uuid(row.correlation_id),
      eventId: row.event_id ? new Uuid(row.event_id) : undefined,
      startedAt: row.started_at as unknown as Date,
      finishedAt: row.finished_at ?? undefined,
      errorMessage: row.error_message ?? undefined,
      resultPayload: asRecord(row.result_payload) ?? {},
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
