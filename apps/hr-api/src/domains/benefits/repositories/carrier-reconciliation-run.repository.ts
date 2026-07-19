import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId, parseNumeric } from '@hcm/database';
import type { Database } from '@hcm/database';
import { CarrierReconciliationRun } from '../aggregates/carrier-reconciliation-run.aggregate.js';

/**
 * Repository for {@link CarrierReconciliationRun} aggregates.
 */
@Injectable()
export class CarrierReconciliationRunRepository extends BaseRepository<'carrier_reconciliation_runs', CarrierReconciliationRun> {
  protected readonly tableName = 'carrier_reconciliation_runs' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for carrier reconciliation run query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<CarrierReconciliationRun | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['carrier_reconciliation_runs']) : undefined;
  }

  async findByCarrier(carrierId: Uuid): Promise<CarrierReconciliationRun[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('carrier_id', '=', carrierId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['carrier_reconciliation_runs']));
  }

  async save(entity: CarrierReconciliationRun): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['carrier_reconciliation_runs']>, { expectedVersion: entity.loadedVersion });
      entity.markPersisted();
    } else {
      await this.insert(row as unknown as Insertable<Database['carrier_reconciliation_runs']>);
    }
  }

  private toAggregate(row: Database['carrier_reconciliation_runs']): CarrierReconciliationRun {
    return new CarrierReconciliationRun({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      carrierId: new Uuid(row.carrier_id),
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalPremium: parseNumeric(row.total_premium),
      totalCollected: parseNumeric(row.total_collected),
      varianceAmount: parseNumeric(row.variance_amount),
      currency: row.currency,
      status: row.status as 'PENDING' | 'IN_PROGRESS' | 'VARIANCE_DETECTED' | 'RECONCILED' | 'FAILED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: CarrierReconciliationRun): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      carrier_id: entity.carrierId.value,
      period_start: entity.periodStart,
      period_end: entity.periodEnd,
      total_premium: entity.totalPremium,
      total_collected: entity.totalCollected,
      variance_amount: entity.varianceAmount,
      currency: entity.currency,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
