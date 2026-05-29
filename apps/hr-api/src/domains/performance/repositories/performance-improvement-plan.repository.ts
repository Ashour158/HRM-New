import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { PerformanceImprovementPlan, type PerformanceImprovementPlanStatus } from '../aggregates/performance-improvement-plan.aggregate.js';

@Injectable()
export class PerformanceImprovementPlanRepository extends BaseRepository<'performance_improvement_plans', PerformanceImprovementPlan> {
  protected readonly tableName = 'performance_improvement_plans' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<PerformanceImprovementPlan | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<PerformanceImprovementPlan[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: PerformanceImprovementPlan): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): PerformanceImprovementPlan {
    return new PerformanceImprovementPlan({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      managerId: new Uuid(row.manager_id),
      objectives: (row.objectives as string[]) ?? [],
      startDate: row.start_date ?? undefined,
      reviewDate: row.review_date ?? undefined,
      endDate: row.end_date ?? undefined,
      outcome: row.outcome ?? undefined,
      status: (row.status as PerformanceImprovementPlanStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: PerformanceImprovementPlan): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      manager_id: entity.managerId.value,
      objectives: entity.objectives,
      start_date: entity.startDate ?? null,
      review_date: entity.reviewDate ?? null,
      end_date: entity.endDate ?? null,
      outcome: entity.outcome ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
