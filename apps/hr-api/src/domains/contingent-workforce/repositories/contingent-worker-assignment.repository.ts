import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { ContingentWorkerAssignment, type ContingentWorkerAssignmentStatus } from '../aggregates/contingent-worker-assignment.aggregate.js';

@Injectable()
export class ContingentWorkerAssignmentRepository extends BaseRepository<'contingent_worker_assignments', ContingentWorkerAssignment> {
  protected readonly tableName = 'contingent_worker_assignments' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<ContingentWorkerAssignment | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['contingent_worker_assignments']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<ContingentWorkerAssignment[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['contingent_worker_assignments']));
  }

  async findByTenant(tenantId: Uuid): Promise<ContingentWorkerAssignment[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['contingent_worker_assignments']));
  }

  async save(entity: ContingentWorkerAssignment): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['contingent_worker_assignments']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['contingent_worker_assignments']>);
    }
  }

  private toAggregate(row: Database['contingent_worker_assignments']): ContingentWorkerAssignment {
    return new ContingentWorkerAssignment({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      vendorId: new Uuid(row.vendor_id),
      projectId: new Uuid(row.project_id),
      startDate: row.start_date,
      endDate: row.end_date,
      rate: row.rate,
      currency: row.currency,
      status: row.status as ContingentWorkerAssignmentStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: ContingentWorkerAssignment): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      vendor_id: entity.vendorId.value,
      project_id: entity.projectId.value,
      start_date: entity.startDate,
      end_date: entity.endDate,
      rate: entity.rate,
      currency: entity.currency,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
