import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getCurrentTenantId, getPool, parseNumeric } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { PayrollInput, type PayrollInputStatus } from '../aggregates/payroll-input.aggregate.js';

@Injectable()
export class PayrollInputRepository extends BaseRepository<'payroll_inputs', PayrollInput> {
  protected readonly tableName = 'payroll_inputs' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<PayrollInput | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['payroll_inputs']) : undefined;
  }

  async findByPayrollCycle(payrollCycleId: Uuid): Promise<PayrollInput[]> {
    const rows = await this.executor.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('payroll_cycle_id', '=', payrollCycleId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['payroll_inputs']));
  }

  async findByWorker(workerId: Uuid): Promise<PayrollInput[]> {
    const rows = await this.executor.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['payroll_inputs']));
  }

  async save(entity: PayrollInput): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['payroll_inputs']>, { expectedVersion: entity.loadedVersion });
      entity.markPersisted();
    } else {
      await this.insert(row as unknown as Insertable<Database['payroll_inputs']>);
    }
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for payroll input query');
    }
    return tenantId.value;
  }

  private toAggregate(row: Database['payroll_inputs']): PayrollInput {
    return new PayrollInput({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      payrollCycleId: new Uuid(row.payroll_cycle_id),
      inputType: row.input_type,
      amount: parseNumeric(row.amount),
      currency: row.currency,
      description: row.description ?? undefined,
      status: row.status as PayrollInputStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: PayrollInput): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      payroll_cycle_id: entity.payrollCycleId.value,
      input_type: entity.inputType,
      amount: entity.amount,
      currency: entity.currency,
      description: entity.description ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
