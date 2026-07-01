import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { SuccessionPlan, type SuccessionPlanStatus } from '../aggregates/succession-plan.aggregate.js';

@Injectable()
export class SuccessionPlanRepository extends BaseRepository<'succession_plans', SuccessionPlan> {
  protected readonly tableName = 'succession_plans' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for succession plan query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<SuccessionPlan | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByPosition(positionId: Uuid): Promise<SuccessionPlan | undefined> {
    const row = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('position_id', '=', positionId.value).executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<SuccessionPlan[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: SuccessionPlan): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): SuccessionPlan {
    return new SuccessionPlan({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      positionId: new Uuid(row.position_id),
      incumbentWorkerId: row.incumbent_worker_id ? new Uuid(row.incumbent_worker_id) : undefined,
      successorCandidates: (row.successor_candidates as unknown as { workerId: string; readinessLevel: number }[] | undefined) ?? [],
      readinessLevels: (row.readiness_levels as Record<string, number>) ?? {},
      status: (row.status as SuccessionPlanStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: SuccessionPlan): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      position_id: entity.positionId.value,
      incumbent_worker_id: entity.incumbentWorkerId?.value ?? null,
      successor_candidates: JSON.stringify(entity.successorCandidates ?? []),
      readiness_levels: entity.readinessLevels,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
