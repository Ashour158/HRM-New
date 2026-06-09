import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { WfmOvertimeApproval, type WfmOvertimeApprovalStatus } from '../aggregates/overtime-approval.aggregate.js';

@Injectable()
export class WfmOvertimeApprovalRepository extends BaseRepository<'wfm_overtime_approvals', WfmOvertimeApproval> {
  protected readonly tableName = 'wfm_overtime_approvals' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<WfmOvertimeApproval | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['wfm_overtime_approvals']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<WfmOvertimeApproval[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['wfm_overtime_approvals']));
  }

  async findByWorker(workerId: Uuid): Promise<WfmOvertimeApproval[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['wfm_overtime_approvals']));
  }



  async save(entity: WfmOvertimeApproval): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['wfm_overtime_approvals']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['wfm_overtime_approvals']>);
    }
  }

  private toAggregate(row: Database['wfm_overtime_approvals']): WfmOvertimeApproval {
    return new WfmOvertimeApproval({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      requestedHours: row.requested_hours,
      reason: row.reason,
      shiftDate: row.shift_date ?? undefined,
      requestedAt: row.requested_at,
      approvedBy: row.approved_by ? new Uuid(row.approved_by) : undefined,
      approvedAt: row.approved_at ?? undefined,
      status: row.status as WfmOvertimeApprovalStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: WfmOvertimeApproval): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      requested_hours: entity.requestedHours,
      reason: entity.reason,
      shift_date: entity.shiftDate ?? null,
      requested_at: entity.requestedAt ?? null,
      approved_by: entity.approvedBy?.value ?? null,
      approved_at: entity.approvedAt ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
