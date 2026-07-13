import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import { CompensationChange } from '../aggregates/compensation-change.aggregate.js';

/**
 * Repository for {@link CompensationChange} aggregates.
 */
@Injectable()
export class CompensationChangeRepository extends BaseRepository<'compensation_changes', CompensationChange> {
  protected readonly tableName = 'compensation_changes' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for compensation change query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<CompensationChange | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['compensation_changes']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<CompensationChange[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['compensation_changes']));
  }

  async findByTenant(tenantId: Uuid): Promise<CompensationChange[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['compensation_changes']));
  }

  async save(entity: CompensationChange): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['compensation_changes']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['compensation_changes']>);
    }
  }

  private toAggregate(row: Database['compensation_changes']): CompensationChange {
    return new CompensationChange({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      changeType: row.change_type,
      oldAmount: row.old_amount ?? undefined,
      newAmount: row.new_amount,
      currency: row.currency,
      effectiveDate: row.effective_date,
      approvedBy: row.approved_by ? new Uuid(row.approved_by) : undefined,
      status: row.status as 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'EFFECTIVE' | 'CANCELLED' | 'REJECTED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: CompensationChange): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      change_type: entity.changeType,
      old_amount: entity.oldAmount ?? null,
      new_amount: entity.newAmount,
      currency: entity.currency,
      effective_date: entity.effectiveDate,
      approved_by: entity.approvedBy?.value ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
