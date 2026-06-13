import { Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import type { Kysely, Selectable } from 'kysely';
import type {
  SchedulerJobRunRecord,
  SchedulerJobRunRepositoryPort,
  TryStartSchedulerJobRunInput,
  TryStartSchedulerJobRunResult,
} from './scheduled-job.js';

type SchedulerJobRunRow = Selectable<Database['scheduler_job_runs']>;

@Injectable()
export class SchedulerJobRunRepository implements SchedulerJobRunRepositoryPort {
  private readonly db: Kysely<Database>;

  constructor(@Optional() db?: Kysely<Database>) {
    this.db = db ?? createKyselyInstance(getPool());
  }

  async tryStartRun(input: TryStartSchedulerJobRunInput): Promise<TryStartSchedulerJobRunResult> {
    const id = Uuid.generate().value;
    const inserted = await this.db
      .insertInto('scheduler_job_runs')
      .values({
        id,
        tenant_id: input.tenantId.value,
        job_name: input.jobName,
        period_key: input.periodKey,
        status: 'RUNNING',
        items_processed: 0,
        error: null,
        started_at: input.startedAt,
        finished_at: null,
        aggregate_version: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .onConflict((oc) => oc.columns(['tenant_id', 'job_name', 'period_key']).doNothing())
      .returningAll()
      .executeTakeFirst();

    if (inserted) {
      return { acquired: true, run: toRecord(inserted) };
    }

    const existing = await this.db
      .selectFrom('scheduler_job_runs')
      .selectAll()
      .where('tenant_id', '=', input.tenantId.value)
      .where('job_name', '=', input.jobName)
      .where('period_key', '=', input.periodKey)
      .executeTakeFirst();

    return {
      acquired: false,
      run: existing ? toRecord(existing) : undefined,
      skipReason: existing?.status === 'SUCCEEDED' ? 'ALREADY_SUCCEEDED' : 'RUNNING',
    };
  }

  async markSucceeded(input: { tenantId: Uuid; runId: Uuid; itemsProcessed: number; finishedAt: Date }): Promise<void> {
    await this.db
      .updateTable('scheduler_job_runs')
      .set({
        status: 'SUCCEEDED',
        items_processed: input.itemsProcessed,
        error: null,
        finished_at: input.finishedAt,
        updated_at: new Date().toISOString(),
        aggregate_version: (eb) => eb('aggregate_version', '+', 1),
      })
      .where('tenant_id', '=', input.tenantId.value)
      .where('id', '=', input.runId.value)
      .execute();
  }

  async markFailed(input: { tenantId: Uuid; runId: Uuid; error: string; itemsProcessed: number; finishedAt: Date }): Promise<void> {
    await this.db
      .updateTable('scheduler_job_runs')
      .set({
        status: 'FAILED',
        items_processed: input.itemsProcessed,
        error: input.error,
        finished_at: input.finishedAt,
        updated_at: new Date().toISOString(),
        aggregate_version: (eb) => eb('aggregate_version', '+', 1),
      })
      .where('tenant_id', '=', input.tenantId.value)
      .where('id', '=', input.runId.value)
      .execute();
  }

  async markSkipped(input: { tenantId: Uuid; jobName: string; periodKey: string; reason: string; at: Date }): Promise<void> {
    await this.db
      .insertInto('scheduler_job_runs')
      .values({
        id: Uuid.generate().value,
        tenant_id: input.tenantId.value,
        job_name: input.jobName,
        period_key: input.periodKey,
        status: 'SKIPPED',
        items_processed: 0,
        error: input.reason,
        started_at: input.at,
        finished_at: input.at,
        aggregate_version: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .onConflict((oc) => oc.columns(['tenant_id', 'job_name', 'period_key']).doNothing())
      .execute();
  }
}

function toRecord(row: SchedulerJobRunRow): SchedulerJobRunRecord {
  return {
    id: new Uuid(row.id),
    tenantId: new Uuid(row.tenant_id),
    jobName: row.job_name,
    periodKey: row.period_key,
    status: row.status as SchedulerJobRunRecord['status'],
    itemsProcessed: row.items_processed,
    error: row.error ?? undefined,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
  };
}
