import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { WorkSchedule, type WorkScheduleStatus } from '../aggregates/work-schedule.aggregate.js';

@Injectable()
export class WorkScheduleRepository extends BaseRepository<'work_schedules', WorkSchedule> {
  protected readonly tableName = 'work_schedules' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for work schedule query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<WorkSchedule | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['work_schedules']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<WorkSchedule[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['work_schedules']));
  }

  /** Batch variant of {@link findByWorker} — one query for many workers (avoids N+1). */
  async findByWorkers(workerIds: Uuid[]): Promise<WorkSchedule[]> {
    if (workerIds.length === 0) return [];
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId())
      .where('worker_id', 'in', workerIds.map((id) => id.value))
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['work_schedules']));
  }

  async save(entity: WorkSchedule): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['work_schedules']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['work_schedules']>);
    }
  }

  private toAggregate(row: Database['work_schedules']): WorkSchedule {
    return new WorkSchedule({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      scheduleType: row.schedule_type,
      startDate: row.start_date,
      endDate: row.end_date ?? undefined,
      daysOfWeek: (row.days_of_week as string[]) ?? [],
      hoursPerDay: row.hours_per_day,
      timezone: row.timezone,
      status: row.status as WorkScheduleStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: WorkSchedule): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      schedule_type: entity.scheduleType,
      start_date: entity.startDate,
      end_date: entity.endDate ?? null,
      days_of_week: JSON.stringify(entity.daysOfWeek),
      hours_per_day: entity.hoursPerDay,
      timezone: entity.timezone,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
