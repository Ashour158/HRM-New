import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { AbsenceAccrualBalance, type AbsenceAccrualBalanceStatus } from '../aggregates/absence-accrual-balance.aggregate.js';

@Injectable()
export class AbsenceAccrualBalanceRepository extends BaseRepository<'absence_accrual_balances', AbsenceAccrualBalance> {
  protected readonly tableName = 'absence_accrual_balances' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for absence accrual balance query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<AbsenceAccrualBalance | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['absence_accrual_balances']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<AbsenceAccrualBalance[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['absence_accrual_balances']));
  }

  async save(entity: AbsenceAccrualBalance): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['absence_accrual_balances']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['absence_accrual_balances']>);
    }
  }

  private toAggregate(row: Database['absence_accrual_balances']): AbsenceAccrualBalance {
    return new AbsenceAccrualBalance({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      leaveType: row.leave_type,
      balanceHours: row.balance_hours,
      accruedHours: row.accrued_hours,
      usedHours: row.used_hours,
      carriedOverHours: row.carried_over_hours,
      effectiveDate: row.effective_date,
      status: row.status as AbsenceAccrualBalanceStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: AbsenceAccrualBalance): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      leave_type: entity.leaveType,
      balance_hours: entity.balanceHours,
      accrued_hours: entity.accruedHours,
      used_hours: entity.usedHours,
      carried_over_hours: entity.carriedOverHours,
      effective_date: entity.effectiveDate,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
