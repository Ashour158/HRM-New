import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId, parseNumeric } from '@hcm/database';
import type { Database } from '@hcm/database';
import { BonusCycle } from '../aggregates/bonus-cycle.aggregate.js';

/**
 * Repository for {@link BonusCycle} aggregates.
 */
@Injectable()
export class BonusCycleRepository extends BaseRepository<'bonus_cycles', BonusCycle> {
  protected readonly tableName = 'bonus_cycles' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for bonus cycle query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<BonusCycle | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['bonus_cycles']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<BonusCycle[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['bonus_cycles']));
  }

  async findByYear(cycleYear: number): Promise<BonusCycle[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('cycle_year', '=', cycleYear)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['bonus_cycles']));
  }

  async save(entity: BonusCycle): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['bonus_cycles']>, { expectedVersion: entity.loadedVersion });
      entity.markPersisted();
    } else {
      await this.insert(row as unknown as Insertable<Database['bonus_cycles']>);
    }
  }

  private toAggregate(row: Database['bonus_cycles']): BonusCycle {
    return new BonusCycle({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      cycleName: row.cycle_name,
      cycleYear: row.cycle_year,
      eligibilityDate: row.eligibility_date,
      paymentDate: row.payment_date,
      totalPoolAmount: parseNumeric(row.total_pool_amount),
      currency: row.currency,
      status: row.status as 'DRAFT' | 'ACTIVE' | 'CALCULATION' | 'REVIEW' | 'APPROVED' | 'PAID' | 'CLOSED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: BonusCycle): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      cycle_name: entity.cycleName,
      cycle_year: entity.cycleYear,
      eligibility_date: entity.eligibilityDate,
      payment_date: entity.paymentDate,
      total_pool_amount: entity.totalPoolAmount,
      currency: entity.currency,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
