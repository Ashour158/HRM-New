import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { LearningAssignment, type LearningAssignmentStatus } from '../aggregates/learning-assignment.aggregate.js';

@Injectable()
export class LearningAssignmentRepository extends BaseRepository<'learning_assignments', LearningAssignment> {
  protected readonly tableName = 'learning_assignments' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for learning assignment query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<LearningAssignment | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<LearningAssignment[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByCourse(courseId: Uuid): Promise<LearningAssignment[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('course_id', '=', courseId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByTenant(tenantId: Uuid): Promise<LearningAssignment[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: LearningAssignment): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): LearningAssignment {
    return new LearningAssignment({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      courseId: new Uuid(row.course_id),
      assignedBy: new Uuid(row.assigned_by),
      assignedAt: row.assigned_at,
      dueDate: row.due_date ?? undefined,
      completedAt: row.completed_at ?? undefined,
      score: row.score ?? undefined,
      status: (row.status as LearningAssignmentStatus) ?? 'ASSIGNED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: LearningAssignment): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      course_id: entity.courseId.value,
      assigned_by: entity.assignedBy.value,
      assigned_at: entity.assignedAt,
      due_date: entity.dueDate ?? null,
      completed_at: entity.completedAt ?? null,
      score: entity.score ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
