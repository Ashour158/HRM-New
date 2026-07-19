import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { PayrollCycle, type PayrollCycleStatus } from '../aggregates/payroll-cycle.aggregate.js';

@Injectable()
export class PayrollCycleRepository extends BaseRepository<'payroll_cycles', PayrollCycle> {
  protected readonly tableName = 'payroll_cycles' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<PayrollCycle | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['payroll_cycles']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<PayrollCycle[]> {
    const rows = await this.executor.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['payroll_cycles']));
  }

  async save(entity: PayrollCycle): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['payroll_cycles']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['payroll_cycles']>);
    }
  }

  private toAggregate(row: Database['payroll_cycles']): PayrollCycle {
    return new PayrollCycle({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      cycleName: row.cycle_name,
      payPeriodStart: row.pay_period_start,
      payPeriodEnd: row.pay_period_end,
      payDate: row.pay_date ?? undefined,
      status: row.status as PayrollCycleStatus,
      openedAt: row.opened_at ?? undefined,
      closedAt: row.closed_at ?? undefined,
      approvedBy: row.approved_by ? new Uuid(row.approved_by) : undefined,
      approvedAt: row.approved_at ?? undefined,
      createdBy: row.created_by ? new Uuid(row.created_by) : undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: PayrollCycle): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      cycle_name: entity.cycleName,
      pay_period_start: entity.payPeriodStart,
      pay_period_end: entity.payPeriodEnd,
      pay_date: entity.payDate ?? null,
      status: entity.status,
      opened_at: entity.openedAt ?? null,
      closed_at: entity.closedAt ?? null,
      approved_by: entity.approvedBy?.value ?? null,
      approved_at: entity.approvedAt ?? null,
      created_by: entity.createdBy?.value ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
