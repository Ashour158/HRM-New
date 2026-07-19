import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool, parseNumeric, resolveTransactionAwareExecutor } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { PayrollPaymentBatchRecord } from '../services/payroll-artifact.service.js';
import type { PayrollPaymentBatch } from '../services/payroll-input-orchestration.service.js';

function dateToDb(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateFromDb(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class PayrollPaymentBatchRepository {
  private readonly db = createKyselyInstance(getPool());
  private readonly tableName = 'payroll_payment_batches' as const;

  /**
   * Joins the ambient command-bus transaction when one is active (see
   * `resolveTransactionAwareExecutor` in `@hcm/database`), otherwise falls
   * back to this repository's own pooled connection.
   */
  private get executor() {
    return resolveTransactionAwareExecutor<Database>(this.db);
  }

  async save(record: PayrollPaymentBatchRecord): Promise<void> {
    const row = this.toRow(record);
    await this.executor
      .insertInto(this.tableName)
      .values(row)
      .onConflict((oc: any) => oc
        .columns(['tenant_id', 'payroll_cycle_id'])
        .doUpdateSet({
          batch_number: row.batch_number,
          status: row.status,
          period_start: row.period_start,
          period_end: row.period_end,
          pay_date: row.pay_date,
          currency: row.currency,
          ready_count: row.ready_count,
          blocked_count: row.blocked_count,
          total_net: row.total_net,
          file_hash: row.file_hash,
          payload: row.payload,
          created_by: row.created_by,
          approved_by: row.approved_by,
          approved_at: row.approved_at,
          exported_at: row.exported_at,
          reconciled_at: row.reconciled_at,
          bank_file_format: row.bank_file_format,
          reconciliation_summary: row.reconciliation_summary,
          workflow_events: row.workflow_events,
          updated_at: row.updated_at,
        }))
      .execute();
  }

  async findById(tenantId: Uuid, id: Uuid): Promise<PayrollPaymentBatchRecord | undefined> {
    const row = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toRecord(row as Database['payroll_payment_batches']) : undefined;
  }

  async findByPayrollCycle(tenantId: Uuid, payrollCycleId: Uuid): Promise<PayrollPaymentBatchRecord | undefined> {
    const row = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('payroll_cycle_id', '=', payrollCycleId.value)
      .executeTakeFirst();
    return row ? this.toRecord(row as Database['payroll_payment_batches']) : undefined;
  }

  async findRecentByTenant(tenantId: Uuid, limit = 20): Promise<PayrollPaymentBatchRecord[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();
    return rows.map((row: any) => this.toRecord(row as Database['payroll_payment_batches']));
  }

  private toRow(record: PayrollPaymentBatchRecord): Insertable<Database['payroll_payment_batches']> {
    return {
      id: record.id,
      tenant_id: record.tenantId,
      payroll_cycle_id: record.payrollCycleId,
      batch_number: record.batchNumber,
      status: record.status,
      period_start: dateToDb(record.periodStart),
      period_end: dateToDb(record.periodEnd),
      pay_date: dateToDb(record.payDate),
      currency: record.currency,
      ready_count: record.readyCount,
      blocked_count: record.blockedCount,
      total_net: String(record.totalNet),
      file_hash: record.fileHash,
      // jsonb columns: serialize explicitly. node-postgres renders a JS array as a
      // Postgres array literal (not JSON), which is invalid for jsonb — so workflow_events
      // (an array) must be JSON.stringify'd. Do the same for the object columns for
      // consistency (pg casts the JSON text to jsonb).
      payload: JSON.stringify(record.payload ?? {}),
      created_by: record.createdBy ?? null,
      approved_by: record.approvedBy ?? null,
      approved_at: record.approvedAt ?? null,
      exported_at: record.exportedAt ?? null,
      reconciled_at: record.reconciledAt ?? null,
      bank_file_format: record.bankFileFormat ?? null,
      reconciliation_summary: JSON.stringify(record.reconciliationSummary ?? {}),
      workflow_events: JSON.stringify(record.workflowEvents ?? []),
      aggregate_version: 0,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    };
  }

  private toRecord(row: Database['payroll_payment_batches']): PayrollPaymentBatchRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      payrollCycleId: row.payroll_cycle_id,
      batchNumber: row.batch_number,
      status: row.status as PayrollPaymentBatchRecord['status'],
      periodStart: dateFromDb(row.period_start),
      periodEnd: dateFromDb(row.period_end),
      payDate: dateFromDb(row.pay_date),
      currency: row.currency,
      readyCount: row.ready_count,
      blockedCount: row.blocked_count,
      totalNet: parseNumeric(row.total_net),
      fileHash: row.file_hash,
      payload: row.payload as PayrollPaymentBatch,
      createdBy: row.created_by ?? undefined,
      approvedBy: row.approved_by ?? undefined,
      approvedAt: row.approved_at ?? undefined,
      exportedAt: row.exported_at ?? undefined,
      reconciledAt: row.reconciled_at ?? undefined,
      bankFileFormat: row.bank_file_format ?? undefined,
      reconciliationSummary: row.reconciliation_summary as Record<string, unknown>,
      workflowEvents: row.workflow_events as Array<Record<string, unknown>>,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
