import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { JobAssignment, type JobAssignmentState } from '../aggregates/job-assignment.aggregate.js';

/**
 * Repository for {@link JobAssignment} aggregates.
 */
@Injectable()
export class JobAssignmentRepository extends BaseRepository<'job_assignments', JobAssignment> {
  protected readonly tableName = 'job_assignments' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<JobAssignment | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['job_assignments']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<JobAssignment[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['job_assignments']));
  }

  async findActiveForWorker(workerId: Uuid): Promise<JobAssignment | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .where('state', '=', 'ACTIVE')
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['job_assignments']) : undefined;
  }

  async save(entity: JobAssignment): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['job_assignments']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['job_assignments']>);
    }
  }

  private toAggregate(row: Database['job_assignments']): JobAssignment {
    return new JobAssignment({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      positionId: row.position_id ? new Uuid(row.position_id) : undefined,
      departmentId: row.department_id ? new Uuid(row.department_id) : undefined,
      managerId: row.manager_id ? new Uuid(row.manager_id) : undefined,
      jobTitle: row.job_title ?? undefined,
      startDate: row.start_date,
      endDate: row.end_date ?? undefined,
      assignmentType: row.assignment_type,
      state: row.state as JobAssignmentState,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: JobAssignment): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      position_id: entity.positionId?.value ?? null,
      department_id: entity.departmentId?.value ?? null,
      manager_id: entity.managerId?.value ?? null,
      job_title: entity.jobTitle ?? null,
      start_date: entity.startDate,
      end_date: entity.endDate ?? null,
      assignment_type: entity.assignmentType,
      state: entity.state,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
