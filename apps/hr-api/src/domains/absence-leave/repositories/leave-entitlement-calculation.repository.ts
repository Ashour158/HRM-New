import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { LeaveEntitlementCalculation, type LeaveEntitlementCalculationStatus } from '../aggregates/leave-entitlement-calculation.aggregate.js';

@Injectable()
export class LeaveEntitlementCalculationRepository extends BaseRepository<'leave_entitlement_calculations', LeaveEntitlementCalculation> {
  protected readonly tableName = 'leave_entitlement_calculations' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for leave entitlement calculation query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<LeaveEntitlementCalculation | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['leave_entitlement_calculations']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<LeaveEntitlementCalculation[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['leave_entitlement_calculations']));
  }

  async save(entity: LeaveEntitlementCalculation): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['leave_entitlement_calculations']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['leave_entitlement_calculations']>);
    }
  }

  private toAggregate(row: Database['leave_entitlement_calculations']): LeaveEntitlementCalculation {
    return new LeaveEntitlementCalculation({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      leaveType: row.leave_type,
      calculatedEntitlement: row.calculated_entitlement,
      usedEntitlement: row.used_entitlement,
      remainingEntitlement: row.remaining_entitlement,
      calculationDate: row.calculation_date,
      status: row.status as LeaveEntitlementCalculationStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: LeaveEntitlementCalculation): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      leave_type: entity.leaveType,
      calculated_entitlement: entity.calculatedEntitlement,
      used_entitlement: entity.usedEntitlement,
      remaining_entitlement: entity.remainingEntitlement,
      calculation_date: entity.calculationDate,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
