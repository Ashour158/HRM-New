import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { Timesheet, type TimesheetStatus, type TimesheetEntry } from '../aggregates/timesheet.aggregate.js';

@Injectable()
export class TimesheetRepository extends BaseRepository<'timesheets', Timesheet> {
  protected readonly tableName = 'timesheets' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for timesheet query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<Timesheet | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['timesheets']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<Timesheet[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['timesheets']));
  }

  async save(entity: Timesheet): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['timesheets']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['timesheets']>);
    }
  }

  private toAggregate(row: Database['timesheets']): Timesheet {
    return new Timesheet({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      periodStart: row.period_start,
      periodEnd: row.period_end,
      entries: (row.entries as TimesheetEntry[]) ?? [],
      totalHours: row.total_hours,
      status: row.status as TimesheetStatus,
      submittedAt: row.submitted_at ?? undefined,
      approvedBy: row.approved_by ? new Uuid(row.approved_by) : undefined,
      approvedAt: row.approved_at ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: Timesheet): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      period_start: entity.periodStart,
      period_end: entity.periodEnd,
      entries: JSON.stringify(entity.entries),
      total_hours: entity.totalHours,
      status: entity.status,
      submitted_at: entity.submittedAt ?? null,
      approved_by: entity.approvedBy?.value ?? null,
      approved_at: entity.approvedAt ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
