import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import { PayScale, type PayScaleStep } from '../aggregates/pay-scale.aggregate.js';

/**
 * Repository for {@link PayScale} aggregates.
 */
@Injectable()
export class PayScaleRepository extends BaseRepository<'pay_scales', PayScale> {
  protected readonly tableName = 'pay_scales' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<PayScale | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['pay_scales']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<PayScale[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['pay_scales']));
  }

  async save(entity: PayScale): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['pay_scales']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['pay_scales']>);
    }
  }

  private toAggregate(row: Database['pay_scales']): PayScale {
    return new PayScale({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      scaleCode: row.scale_code,
      grade: row.grade,
      steps: (row.steps as PayScaleStep[]) ?? [],
      currency: row.currency,
      status: row.status as 'DRAFT' | 'ACTIVE' | 'REVISED' | 'CLOSED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: PayScale): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      scale_code: entity.scaleCode,
      grade: entity.grade,
      steps: JSON.stringify(entity.steps ?? []),
      currency: entity.currency,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
