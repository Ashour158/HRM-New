import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { Goal, type GoalStatus } from '../aggregates/goal.aggregate.js';

@Injectable()
export class GoalRepository extends BaseRepository<'goals', Goal> {
  protected readonly tableName = 'goals' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<Goal | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<Goal[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: Goal): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): Goal {
    return new Goal({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      title: row.title,
      description: row.description ?? undefined,
      targetValue: row.target_value ?? undefined,
      currentValue: row.current_value ?? undefined,
      unit: row.unit ?? undefined,
      startDate: row.start_date ?? undefined,
      dueDate: row.due_date ?? undefined,
      smartCriteria: (row.smart_criteria as Goal['smartCriteria']) ?? {},
      metricName: row.metric_name ?? undefined,
      baselineValue: row.baseline_value ?? undefined,
      weight: row.weight ?? undefined,
      reviewCadence: row.review_cadence ?? undefined,
      evidenceRequired: Boolean(row.evidence_required ?? false),
      status: (row.status as GoalStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: Goal): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      title: entity.title,
      description: entity.description ?? null,
      target_value: entity.targetValue ?? null,
      current_value: entity.currentValue ?? null,
      unit: entity.unit ?? null,
      start_date: entity.startDate ?? null,
      due_date: entity.dueDate ?? null,
      smart_criteria: JSON.stringify(entity.smartCriteria ?? {}),
      metric_name: entity.metricName ?? null,
      baseline_value: entity.baselineValue ?? null,
      weight: entity.weight ?? null,
      review_cadence: entity.reviewCadence ?? null,
      evidence_required: entity.evidenceRequired,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
