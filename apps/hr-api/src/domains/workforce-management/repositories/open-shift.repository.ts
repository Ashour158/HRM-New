import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { OpenShift, type OpenShiftStatus } from '../aggregates/open-shift.aggregate.js';

@Injectable()
export class OpenShiftRepository extends BaseRepository<'open_shifts', OpenShift> {
  protected readonly tableName = 'open_shifts' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<OpenShift | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['open_shifts']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<OpenShift[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['open_shifts']));
  }

  async findByTenantScoped(tenantId: Uuid, workplaceCode?: string): Promise<OpenShift[]> {
    let query = this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value);
    if (workplaceCode) query = query.where('workplace_code', '=', workplaceCode);
    const rows = await query.execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['open_shifts']));
  }

  async findByDepartment(departmentId: Uuid): Promise<OpenShift[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('department_id', '=', departmentId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['open_shifts']));
  }



  async save(entity: OpenShift): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['open_shifts']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['open_shifts']>);
    }
  }

  private toAggregate(row: Database['open_shifts']): OpenShift {
    return new OpenShift({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      departmentId: new Uuid(row.department_id),
      workplaceCode: row.workplace_code ?? undefined,
      shiftDate: row.shift_date,
      startTime: row.start_time,
      endTime: row.end_time,
      requiredSkills: Array.isArray(row.required_skills) ? (row.required_skills as string[]) : [],
      bidDeadline: row.bid_deadline ?? undefined,
      filledByWorkerId: row.filled_by_worker_id ? new Uuid(row.filled_by_worker_id) : undefined,
      status: row.status as OpenShiftStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: OpenShift): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      department_id: entity.departmentId.value,
      workplace_code: entity.workplaceCode ?? null,
      shift_date: entity.shiftDate,
      start_time: entity.startTime,
      end_time: entity.endTime,
      required_skills: entity.requiredSkills ?? [],
      bid_deadline: entity.bidDeadline ?? null,
      filled_by_worker_id: entity.filledByWorkerId?.value ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
