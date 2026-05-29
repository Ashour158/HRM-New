import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { PayrollPayslipArtifactRecord } from '../services/payroll-artifact.service.js';

@Injectable()
export class PayrollPayslipArtifactRepository {
  private readonly db = createKyselyInstance(getPool());
  private readonly tableName = 'payroll_payslip_artifacts' as const;

  async save(record: PayrollPayslipArtifactRecord): Promise<void> {
    const row = this.toRow(record);
    await this.db
      .insertInto(this.tableName)
      .values(row)
      .onConflict((oc) => oc
        .columns(['tenant_id', 'payroll_cycle_id', 'worker_id'])
        .doUpdateSet({
          employee_id: row.employee_id,
          artifact_format: row.artifact_format,
          status: row.status,
          gross_pay: row.gross_pay,
          net_pay: row.net_pay,
          currency: row.currency,
          content_hash: row.content_hash,
          html_content: row.html_content,
          data_classification: row.data_classification,
          published_by: row.published_by,
          published_at: row.published_at,
          updated_at: row.updated_at,
        }))
      .execute();
  }

  async saveMany(records: PayrollPayslipArtifactRecord[]): Promise<void> {
    for (const record of records) {
      await this.save(record);
    }
  }

  async findByPayrollCycle(tenantId: Uuid, payrollCycleId: Uuid): Promise<PayrollPayslipArtifactRecord[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('payroll_cycle_id', '=', payrollCycleId.value)
      .orderBy('employee_id', 'asc')
      .execute();
    return rows.map((row) => this.toRecord(row as Database['payroll_payslip_artifacts']));
  }

  async findByCycleAndWorker(tenantId: Uuid, payrollCycleId: Uuid, workerId: Uuid): Promise<PayrollPayslipArtifactRecord | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('payroll_cycle_id', '=', payrollCycleId.value)
      .where('worker_id', '=', workerId.value)
      .executeTakeFirst();
    return row ? this.toRecord(row as Database['payroll_payslip_artifacts']) : undefined;
  }

  private toRow(record: PayrollPayslipArtifactRecord): Insertable<Database['payroll_payslip_artifacts']> {
    return {
      id: record.id,
      tenant_id: record.tenantId,
      payroll_cycle_id: record.payrollCycleId,
      worker_id: record.workerId,
      employee_id: record.employeeId,
      artifact_format: record.artifactFormat,
      status: record.status,
      gross_pay: record.grossPay,
      net_pay: record.netPay,
      currency: record.currency,
      content_hash: record.contentHash,
      html_content: record.htmlContent,
      data_classification: record.dataClassification,
      published_by: record.publishedBy ?? null,
      published_at: record.publishedAt ?? null,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    };
  }

  private toRecord(row: Database['payroll_payslip_artifacts']): PayrollPayslipArtifactRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      payrollCycleId: row.payroll_cycle_id,
      workerId: row.worker_id,
      employeeId: row.employee_id,
      artifactFormat: row.artifact_format as PayrollPayslipArtifactRecord['artifactFormat'],
      status: row.status as PayrollPayslipArtifactRecord['status'],
      grossPay: row.gross_pay,
      netPay: row.net_pay,
      currency: row.currency,
      contentHash: row.content_hash,
      htmlContent: row.html_content,
      dataClassification: row.data_classification as PayrollPayslipArtifactRecord['dataClassification'],
      publishedBy: row.published_by ?? undefined,
      publishedAt: row.published_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
