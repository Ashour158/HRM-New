import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { ShiftBid, type ShiftBidStatus } from '../aggregates/shift-bid.aggregate.js';

@Injectable()
export class ShiftBidRepository extends BaseRepository<'shift_bids', ShiftBid> {
  protected readonly tableName = 'shift_bids' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for shift bid query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<ShiftBid | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['shift_bids']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<ShiftBid[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['shift_bids']));
  }

  async findByWorker(workerId: Uuid): Promise<ShiftBid[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['shift_bids']));
  }



  async save(entity: ShiftBid): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['shift_bids']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['shift_bids']>);
    }
  }

  private toAggregate(row: Database['shift_bids']): ShiftBid {
    return new ShiftBid({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      openShiftId: new Uuid(row.open_shift_id),
      bidAt: row.bid_date,
      approvedBy: row.approved_by ? new Uuid(row.approved_by) : undefined,
      approvedAt: row.approved_at ?? undefined,
      status: row.status as ShiftBidStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: ShiftBid): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      open_shift_id: entity.openShiftId.value,
      bid_date: entity.bidAt ?? null,
      approved_by: entity.approvedBy?.value ?? null,
      approved_at: entity.approvedAt ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
