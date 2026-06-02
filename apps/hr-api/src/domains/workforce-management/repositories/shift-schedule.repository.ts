import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { ShiftSchedule, type ShiftScheduleStatus } from '../aggregates/shift-schedule.aggregate.js';

@Injectable()
export class ShiftScheduleRepository extends BaseRepository<'shift_schedules', ShiftSchedule> {
  protected readonly tableName = 'shift_schedules' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<ShiftSchedule | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['shift_schedules']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<ShiftSchedule[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['shift_schedules']));
  }

  async findByTenant(tenantId: Uuid): Promise<ShiftSchedule[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['shift_schedules']));
  }

  async findByTenantScoped(tenantId: Uuid, workplaceCode?: string): Promise<ShiftSchedule[]> {
    let query = this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value);
    if (workplaceCode) query = query.where('workplace_code', '=', workplaceCode);
    const rows = await query.execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['shift_schedules']));
  }

  async save(entity: ShiftSchedule): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['shift_schedules']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['shift_schedules']>);
    }
  }

  private toAggregate(row: Database['shift_schedules']): ShiftSchedule {
    return new ShiftSchedule({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      shiftDate: row.shift_date,
      startTime: row.start_time,
      endTime: row.end_time,
      breakDuration: row.break_duration,
      departmentId: new Uuid(row.department_id),
      workplaceCode: row.workplace_code ?? undefined,
      status: row.status as ShiftScheduleStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: ShiftSchedule): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      shift_date: entity.shiftDate,
      start_time: entity.startTime,
      end_time: entity.endTime,
      break_duration: entity.breakDuration,
      department_id: entity.departmentId.value,
      workplace_code: entity.workplaceCode ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
