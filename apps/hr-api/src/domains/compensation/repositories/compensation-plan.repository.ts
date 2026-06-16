import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import { CompensationPlan } from '../aggregates/compensation-plan.aggregate.js';

/**
 * Repository for {@link CompensationPlan} aggregates.
 */
@Injectable()
export class CompensationPlanRepository extends BaseRepository<'compensation_plans', CompensationPlan> {
  protected readonly tableName = 'compensation_plans' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for compensation plan query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<CompensationPlan | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['compensation_plans']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<CompensationPlan[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['compensation_plans']));
  }

  async findActive(): Promise<CompensationPlan[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('status', '=', 'ACTIVE')
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['compensation_plans']));
  }

  async save(entity: CompensationPlan): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['compensation_plans']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['compensation_plans']>);
    }
  }

  private toAggregate(row: Database['compensation_plans']): CompensationPlan {
    return new CompensationPlan({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      name: row.name,
      planType: row.plan_type,
      currency: row.currency,
      effectiveFrom: row.effective_from ?? undefined,
      effectiveUntil: row.effective_until ?? undefined,
      status: row.status as 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: CompensationPlan): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      name: entity.name,
      plan_type: entity.planType,
      currency: entity.currency,
      effective_from: entity.effectiveFrom ?? null,
      effective_until: entity.effectiveUntil ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
