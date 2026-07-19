import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool, resolveTransactionAwareExecutor } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { PayrollExportJobRecord } from '../services/payroll-artifact.service.js';

@Injectable()
export class PayrollExportJobRepository {
  private readonly db = createKyselyInstance(getPool());
  private readonly tableName = 'payroll_export_jobs' as const;

  /**
   * Joins the ambient command-bus transaction when one is active (see
   * `resolveTransactionAwareExecutor` in `@hcm/database`), otherwise falls
   * back to this repository's own pooled connection. Writes through this
   * getter are atomic with the audit/outbox/idempotency rows the command bus
   * writes in the same transaction.
   */
  private get executor() {
    return resolveTransactionAwareExecutor<Database>(this.db);
  }

  async save(record: PayrollExportJobRecord): Promise<void> {
    await this.executor.insertInto(this.tableName).values(this.toRow(record)).execute();
  }

  async findByTenant(tenantId: Uuid, limit = 20): Promise<PayrollExportJobRecord[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();
    return rows.map((row: any) => this.toRecord(row as Database['payroll_export_jobs']));
  }

  async findByPayrollCycle(tenantId: Uuid, payrollCycleId: Uuid): Promise<PayrollExportJobRecord[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('payroll_cycle_id', '=', payrollCycleId.value)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map((row: any) => this.toRecord(row as Database['payroll_export_jobs']));
  }

  private toRow(record: PayrollExportJobRecord): Insertable<Database['payroll_export_jobs']> {
    return {
      id: record.id,
      tenant_id: record.tenantId,
      payroll_cycle_id: record.payrollCycleId ?? null,
      export_type: record.exportType,
      status: record.status,
      requested_by: record.requestedBy ?? null,
      purpose: record.purpose,
      filters: record.filters,
      row_count: record.rowCount,
      file_name: record.fileName,
      file_hash: record.fileHash,
      data_classification: record.dataClassification,
      aggregate_version: 0,
      created_at: record.createdAt,
      completed_at: record.completedAt,
    };
  }

  private toRecord(row: Database['payroll_export_jobs']): PayrollExportJobRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      payrollCycleId: row.payroll_cycle_id ?? undefined,
      exportType: row.export_type,
      status: row.status as PayrollExportJobRecord['status'],
      requestedBy: row.requested_by ?? undefined,
      purpose: row.purpose,
      filters: row.filters as Record<string, unknown>,
      rowCount: row.row_count,
      fileName: row.file_name,
      fileHash: row.file_hash,
      dataClassification: row.data_classification as PayrollExportJobRecord['dataClassification'],
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }
}
