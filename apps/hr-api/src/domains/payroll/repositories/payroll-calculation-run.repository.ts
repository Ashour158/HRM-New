import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getCurrentTenantId, getPool, parseNumeric } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { PayrollCalculationRun, type PayrollCalculationRunStatus } from '../aggregates/payroll-calculation-run.aggregate.js';

@Injectable()
export class PayrollCalculationRunRepository extends BaseRepository<'payroll_calculation_runs', PayrollCalculationRun> {
  protected readonly tableName = 'payroll_calculation_runs' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<PayrollCalculationRun | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['payroll_calculation_runs']) : undefined;
  }

  async findByPayrollCycle(payrollCycleId: Uuid): Promise<PayrollCalculationRun[]> {
    const rows = await this.executor.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('payroll_cycle_id', '=', payrollCycleId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['payroll_calculation_runs']));
  }

  async save(entity: PayrollCalculationRun): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['payroll_calculation_runs']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['payroll_calculation_runs']>);
    }
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for payroll calculation run query');
    }
    return tenantId.value;
  }

  private toAggregate(row: Database['payroll_calculation_runs']): PayrollCalculationRun {
    return new PayrollCalculationRun({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      payrollCycleId: new Uuid(row.payroll_cycle_id),
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      totalWorkers: row.total_workers,
      totalGrossPay: parseNumeric(row.total_gross_pay),
      totalNetPay: parseNumeric(row.total_net_pay),
      currency: row.currency,
      status: row.status as PayrollCalculationRunStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: PayrollCalculationRun): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      payroll_cycle_id: entity.payrollCycleId.value,
      started_at: entity.startedAt ?? null,
      completed_at: entity.completedAt ?? null,
      total_workers: entity.totalWorkers,
      total_gross_pay: entity.totalGrossPay,
      total_net_pay: entity.totalNetPay,
      currency: entity.currency,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
