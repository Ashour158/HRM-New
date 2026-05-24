import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { LeaveCase, type LeaveCaseStatus } from '../aggregates/leave-case.aggregate.js';

@Injectable()
export class LeaveCaseRepository extends BaseRepository<'leave_cases', LeaveCase> {
  protected readonly tableName = 'leave_cases' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<LeaveCase | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['leave_cases']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<LeaveCase[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['leave_cases']));
  }

  async save(entity: LeaveCase): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['leave_cases']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['leave_cases']>);
    }
  }

  private toAggregate(row: Database['leave_cases']): LeaveCase {
    return new LeaveCase({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      leaveType: row.leave_type,
      startDate: row.start_date,
      expectedReturnDate: row.expected_return_date ?? undefined,
      actualReturnDate: row.actual_return_date ?? undefined,
      status: row.status as LeaveCaseStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: LeaveCase): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      leave_type: entity.leaveType,
      start_date: entity.startDate,
      expected_return_date: entity.expectedReturnDate ?? null,
      actual_return_date: entity.actualReturnDate ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
