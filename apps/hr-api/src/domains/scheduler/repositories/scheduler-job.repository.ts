import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import type { Insertable, Kysely, Selectable, Updateable } from 'kysely';
import type { SchedulerJob, SchedulerJobRepositoryPort, SchedulerJobStatus, SchedulerJobType, SchedulerScheduleKind } from '../scheduler.types.js';

type SchedulerJobTable = Database['hr_scheduler.scheduler_jobs'];
type SchedulerJobRow = Selectable<SchedulerJobTable>;

@Injectable()
export class SchedulerJobRepository implements SchedulerJobRepositoryPort {
  private readonly db: Kysely<Database>;
  private readonly tableName = 'hr_scheduler.scheduler_jobs' as const;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findDueJobs(tenantId: Uuid, dueAt: Date): Promise<SchedulerJob[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('enabled', '=', true)
      .where('status', '=', 'ACTIVE')
      .where('next_run_at', '<=', dueAt)
      .execute();
    return rows.map((row) => this.toAggregate(row));
  }

  async findByKey(tenantId: Uuid, jobKey: string): Promise<SchedulerJob | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('job_key', '=', jobKey)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async save(job: SchedulerJob): Promise<void> {
    const row = this.toRow(job);
    await this.db
      .insertInto(this.tableName)
      .values(row as Insertable<SchedulerJobTable>)
      .onConflict((oc) => oc.columns(['tenant_id', 'job_key']).doUpdateSet(row as Updateable<SchedulerJobTable>))
      .execute();
  }

  async markRunCompleted(input: { tenantId: Uuid; jobId: Uuid; lastRunAt: Date; nextRunAt?: Date }): Promise<void> {
    await this.db
      .updateTable(this.tableName)
      .set({
        last_run_at: input.lastRunAt,
        next_run_at: input.nextRunAt ?? null,
        updated_at: new Date().toISOString(),
    } as Updateable<SchedulerJobTable>)
      .where('tenant_id', '=', input.tenantId.value)
      .where('id', '=', input.jobId.value)
      .execute();
  }

  private toAggregate(row: SchedulerJobRow): SchedulerJob {
    return {
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      jobKey: row.job_key,
      label: row.label,
      description: row.description ?? undefined,
      jobType: row.job_type as SchedulerJobType,
      scheduleKind: row.schedule_kind as SchedulerScheduleKind,
      status: row.status as SchedulerJobStatus,
      enabled: row.enabled,
      commandName: row.command_name ?? undefined,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id ? new Uuid(row.aggregate_id) : undefined,
      payloadTemplate: asRecord(row.payload_template),
      eventName: row.event_name ?? undefined,
      eventPayloadTemplate: asRecord(row.event_payload_template),
      nextRunAt: row.next_run_at ?? undefined,
      lastRunAt: row.last_run_at ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    };
  }

  private toRow(job: SchedulerJob): Record<string, unknown> {
    return {
      id: job.id.value,
      tenant_id: job.tenantId.value,
      job_key: job.jobKey,
      label: job.label,
      description: job.description ?? null,
      job_type: job.jobType,
      schedule_kind: job.scheduleKind,
      status: job.status,
      enabled: job.enabled,
      command_name: job.commandName ?? null,
      aggregate_type: job.aggregateType,
      aggregate_id: job.aggregateId?.value ?? null,
      payload_template: job.payloadTemplate ?? {},
      event_name: job.eventName ?? null,
      event_payload_template: job.eventPayloadTemplate ?? {},
      next_run_at: job.nextRunAt ?? null,
      last_run_at: job.lastRunAt ?? null,
      aggregate_version: job.aggregateVersion,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
