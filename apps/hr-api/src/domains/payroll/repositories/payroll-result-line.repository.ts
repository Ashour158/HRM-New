import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { PayrollResultLine, type PayrollResultLineStatus } from '../aggregates/payroll-result-line.aggregate.js';

@Injectable()
export class PayrollResultLineRepository extends BaseRepository<'payroll_result_lines', PayrollResultLine> {
  protected readonly tableName = 'payroll_result_lines' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<PayrollResultLine | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['payroll_result_lines']) : undefined;
  }

  async findByPayrollCycle(payrollCycleId: Uuid): Promise<PayrollResultLine[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('payroll_cycle_id', '=', payrollCycleId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['payroll_result_lines']));
  }

  async findByCalculationRun(calculationRunId: Uuid): Promise<PayrollResultLine[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('calculation_run_id', '=', calculationRunId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['payroll_result_lines']));
  }

  async save(entity: PayrollResultLine): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['payroll_result_lines']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['payroll_result_lines']>);
    }
  }

  private toAggregate(row: Database['payroll_result_lines']): PayrollResultLine {
    return new PayrollResultLine({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      payrollCycleId: new Uuid(row.payroll_cycle_id),
      calculationRunId: new Uuid(row.calculation_run_id),
      lineType: row.line_type,
      description: row.description,
      amount: row.amount,
      currency: row.currency,
      ruleSetId: row.rule_set_id ?? undefined,
      ruleId: row.rule_id ?? undefined,
      explanation: row.explanation ?? undefined,
      status: row.status as PayrollResultLineStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: PayrollResultLine): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      payroll_cycle_id: entity.payrollCycleId.value,
      calculation_run_id: entity.calculationRunId.value,
      line_type: entity.lineType,
      description: entity.description,
      amount: entity.amount,
      currency: entity.currency,
      rule_set_id: entity.ruleSetId ?? null,
      rule_id: entity.ruleId ?? null,
      explanation: entity.explanation ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
