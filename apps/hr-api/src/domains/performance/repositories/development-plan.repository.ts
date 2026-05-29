import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { DevelopmentPlan, type DevelopmentPlanStatus } from '../aggregates/development-plan.aggregate.js';

@Injectable()
export class DevelopmentPlanRepository extends BaseRepository<'development_plans', DevelopmentPlan> {
  protected readonly tableName = 'development_plans' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<DevelopmentPlan | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<DevelopmentPlan[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: DevelopmentPlan): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): DevelopmentPlan {
    return new DevelopmentPlan({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      managerId: row.manager_id ? new Uuid(row.manager_id) : undefined,
      title: row.title,
      description: row.description ?? undefined,
      objectives: row.objectives ?? [],
      startDate: row.start_date ?? undefined,
      targetCompletionDate: row.target_completion_date ?? undefined,
      actualCompletionDate: row.actual_completion_date ?? undefined,
      status: (row.status as DevelopmentPlanStatus) ?? 'DRAFT',
      outcome: row.outcome ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: DevelopmentPlan): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      manager_id: entity.managerId?.value ?? null,
      title: entity.title,
      description: entity.description ?? null,
      objectives: JSON.stringify(entity.objectives ?? []),
      start_date: entity.startDate ?? null,
      target_completion_date: entity.targetCompletionDate ?? null,
      actual_completion_date: entity.actualCompletionDate ?? null,
      status: entity.status,
      outcome: entity.outcome ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
