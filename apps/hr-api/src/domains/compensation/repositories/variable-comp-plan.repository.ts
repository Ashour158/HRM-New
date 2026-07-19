import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool, parseNumeric } from '@hcm/database';
import type { Database } from '@hcm/database';
import { VariableCompPlan } from '../aggregates/variable-comp-plan.aggregate.js';

/**
 * Repository for {@link VariableCompPlan} aggregates.
 */
@Injectable()
export class VariableCompPlanRepository extends BaseRepository<'variable_comp_plans', VariableCompPlan> {
  protected readonly tableName = 'variable_comp_plans' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<VariableCompPlan | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['variable_comp_plans']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<VariableCompPlan[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['variable_comp_plans']));
  }

  async save(entity: VariableCompPlan): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['variable_comp_plans']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['variable_comp_plans']>);
    }
  }

  private toAggregate(row: Database['variable_comp_plans']): VariableCompPlan {
    return new VariableCompPlan({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      name: row.name,
      planType: row.plan_type,
      targetPercentage: parseNumeric(row.target_percentage),
      maxPercentage: parseNumeric(row.max_percentage),
      currency: row.currency,
      status: row.status as 'DRAFT' | 'ACTIVE' | 'CLOSED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: VariableCompPlan): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      name: entity.name,
      plan_type: entity.planType,
      target_percentage: entity.targetPercentage,
      max_percentage: entity.maxPercentage,
      currency: entity.currency,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
