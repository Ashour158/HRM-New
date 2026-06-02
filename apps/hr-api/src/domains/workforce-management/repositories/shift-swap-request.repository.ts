import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { ShiftSwapRequest, type ShiftSwapRequestStatus } from '../aggregates/shift-swap-request.aggregate.js';

@Injectable()
export class ShiftSwapRequestRepository extends BaseRepository<'shift_swap_requests', ShiftSwapRequest> {
  protected readonly tableName = 'shift_swap_requests' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<ShiftSwapRequest | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['shift_swap_requests']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<ShiftSwapRequest[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['shift_swap_requests']));
  }

  async findByRequester(requesterWorkerId: Uuid): Promise<ShiftSwapRequest[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('requester_worker_id', '=', requesterWorkerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['shift_swap_requests']));
  }



  async save(entity: ShiftSwapRequest): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['shift_swap_requests']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['shift_swap_requests']>);
    }
  }

  private toAggregate(row: Database['shift_swap_requests']): ShiftSwapRequest {
    return new ShiftSwapRequest({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      requesterWorkerId: new Uuid(row.requester_worker_id),
      requestedWorkerId: new Uuid(row.target_worker_id),
      originalShiftId: new Uuid(row.original_shift_id),
      targetShiftId: new Uuid(row.target_shift_id),
      reason: row.reason ?? undefined,
      approvedBy: row.approved_by ? new Uuid(row.approved_by) : undefined,
      status: row.status as ShiftSwapRequestStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: ShiftSwapRequest): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      requester_worker_id: entity.requesterWorkerId.value,
      target_worker_id: entity.requestedWorkerId.value,
      original_shift_id: entity.originalShiftId.value,
      target_shift_id: entity.targetShiftId.value,
      reason: entity.reason ?? null,
      approved_by: entity.approvedBy?.value ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
