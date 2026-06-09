import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { PayrollGlPostingLine, PayrollGlPostingRecord } from '../services/payroll-gl-posting.service.js';

@Injectable()
export class PayrollGlPostingRepository {
  private readonly db = createKyselyInstance(getPool());
  private readonly tableName = 'payroll_gl_postings' as const;

  async save(record: PayrollGlPostingRecord): Promise<void> {
    const row = this.toRow(record);
    await this.db
      .insertInto(this.tableName)
      .values(row)
      .onConflict((oc: any) => oc
        .columns(['tenant_id', 'payroll_cycle_id'])
        .doUpdateSet({
          posting_number: row.posting_number,
          status: row.status,
          total_debits: row.total_debits,
          total_credits: row.total_credits,
          currency: row.currency,
          lines: row.lines,
          source_hash: row.source_hash,
          created_by: row.created_by,
          approved_by: row.approved_by,
          posted_at: row.posted_at,
          updated_at: row.updated_at,
        }))
      .execute();
  }

  async findByPayrollCycle(tenantId: Uuid, payrollCycleId: Uuid): Promise<PayrollGlPostingRecord | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('payroll_cycle_id', '=', payrollCycleId.value)
      .executeTakeFirst();
    return row ? this.toRecord(row as Database['payroll_gl_postings']) : undefined;
  }

  private toRow(record: PayrollGlPostingRecord): Insertable<Database['payroll_gl_postings']> {
    return {
      id: record.id,
      tenant_id: record.tenantId,
      payroll_cycle_id: record.payrollCycleId,
      posting_number: record.postingNumber,
      status: record.status,
      total_debits: record.totalDebits,
      total_credits: record.totalCredits,
      currency: record.currency,
      lines: record.lines,
      source_hash: record.sourceHash,
      created_by: record.createdBy ?? null,
      approved_by: record.approvedBy ?? null,
      posted_at: record.postedAt ?? null,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    };
  }

  private toRecord(row: Database['payroll_gl_postings']): PayrollGlPostingRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      payrollCycleId: row.payroll_cycle_id,
      postingNumber: row.posting_number,
      status: row.status as PayrollGlPostingRecord['status'],
      totalDebits: row.total_debits,
      totalCredits: row.total_credits,
      currency: row.currency,
      lines: row.lines as PayrollGlPostingLine[],
      sourceHash: row.source_hash,
      createdBy: row.created_by ?? undefined,
      approvedBy: row.approved_by ?? undefined,
      postedAt: row.posted_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
