import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Selectable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';

export type PayrollCycleCloseJobStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface PayrollCycleCloseJobEmployeeError {
  workerId: string;
  employeeId?: string;
  stage: string;
  message: string;
}

export interface PayrollCycleCloseJobRecord {
  id: Uuid;
  tenantId: Uuid;
  status: PayrollCycleCloseJobStatus;
  year: number;
  month: number;
  workLocationCode?: string;
  closeCycle: boolean;
  batchSize: number;
  totalEmployees: number;
  processedEmployees: number;
  totalBatches: number;
  currentBatch: number;
  payrollCycleId?: string;
  payrollCalculationRunId?: string;
  errors: PayrollCycleCloseJobEmployeeError[];
  errorMessage?: string;
  result?: Record<string, unknown>;
  requestedBy?: string;
  startedAt: Date;
  finishedAt?: Date;
  updatedAt: Date;
}

export interface CreatePayrollCycleCloseJobInput {
  tenantId: Uuid;
  year: number;
  month: number;
  workLocationCode?: string;
  closeCycle: boolean;
  batchSize: number;
  totalEmployees: number;
  totalBatches: number;
  requestedBy?: string;
}

export interface PayrollCycleCloseJobProgressPatch {
  processedEmployees?: number;
  currentBatch?: number;
  totalBatches?: number;
  totalEmployees?: number;
  payrollCycleId?: string;
  payrollCalculationRunId?: string;
  errors?: PayrollCycleCloseJobEmployeeError[];
}

type Row = Selectable<Database['payroll_cycle_close_jobs']>;

@Injectable()
export class PayrollCycleCloseJobRepository {
  private readonly db = createKyselyInstance(getPool());
  private readonly tableName = 'payroll_cycle_close_jobs' as const;

  async create(input: CreatePayrollCycleCloseJobInput): Promise<PayrollCycleCloseJobRecord> {
    const now = new Date();
    const row = {
      id: Uuid.generate().value,
      tenant_id: input.tenantId.value,
      status: 'RUNNING',
      year: input.year,
      month: input.month,
      work_location_code: input.workLocationCode ?? null,
      close_cycle: input.closeCycle,
      batch_size: input.batchSize,
      total_employees: input.totalEmployees,
      processed_employees: 0,
      total_batches: input.totalBatches,
      current_batch: 0,
      payroll_cycle_id: null,
      payroll_calculation_run_id: null,
      errors: [],
      error_message: null,
      result: {},
      requested_by: input.requestedBy ?? null,
      started_at: now,
      finished_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    } satisfies Insertable<Database['payroll_cycle_close_jobs']>;
    const inserted = await this.db
      .insertInto(this.tableName)
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toRecord(inserted);
  }

  async findById(tenantId: Uuid, id: Uuid): Promise<PayrollCycleCloseJobRecord | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toRecord(row) : undefined;
  }

  async updateProgress(tenantId: Uuid, id: Uuid, patch: PayrollCycleCloseJobProgressPatch): Promise<void> {
    const update: Updateable<Database['payroll_cycle_close_jobs']> = { updated_at: new Date().toISOString() };
    if (patch.processedEmployees !== undefined) update.processed_employees = patch.processedEmployees;
    if (patch.currentBatch !== undefined) update.current_batch = patch.currentBatch;
    if (patch.totalBatches !== undefined) update.total_batches = patch.totalBatches;
    if (patch.totalEmployees !== undefined) update.total_employees = patch.totalEmployees;
    if (patch.payrollCycleId !== undefined) update.payroll_cycle_id = patch.payrollCycleId;
    if (patch.payrollCalculationRunId !== undefined) update.payroll_calculation_run_id = patch.payrollCalculationRunId;
    if (patch.errors !== undefined) update.errors = patch.errors as unknown as Record<string, unknown>;
    await this.db
      .updateTable(this.tableName)
      .set(update)
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', id.value)
      .execute();
  }

  async markSucceeded(tenantId: Uuid, id: Uuid, result: Record<string, unknown>): Promise<void> {
    await this.db
      .updateTable(this.tableName)
      .set({
        status: 'SUCCEEDED',
        result: result as unknown as Record<string, unknown>,
        finished_at: new Date(),
        updated_at: new Date().toISOString(),
      })
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', id.value)
      .execute();
  }

  async markFailed(tenantId: Uuid, id: Uuid, errorMessage: string): Promise<void> {
    await this.db
      .updateTable(this.tableName)
      .set({
        status: 'FAILED',
        error_message: errorMessage,
        finished_at: new Date(),
        updated_at: new Date().toISOString(),
      })
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', id.value)
      .execute();
  }

  private toRecord(row: Row): PayrollCycleCloseJobRecord {
    return {
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      status: row.status as PayrollCycleCloseJobStatus,
      year: row.year,
      month: row.month,
      workLocationCode: row.work_location_code ?? undefined,
      closeCycle: row.close_cycle,
      batchSize: row.batch_size,
      totalEmployees: row.total_employees,
      processedEmployees: row.processed_employees,
      totalBatches: row.total_batches,
      currentBatch: row.current_batch,
      payrollCycleId: row.payroll_cycle_id ?? undefined,
      payrollCalculationRunId: row.payroll_calculation_run_id ?? undefined,
      errors: Array.isArray(row.errors) ? row.errors as PayrollCycleCloseJobEmployeeError[] : [],
      errorMessage: row.error_message ?? undefined,
      result: (row.result ?? {}) as Record<string, unknown>,
      requestedBy: row.requested_by ?? undefined,
      startedAt: row.started_at as unknown as Date,
      finishedAt: row.finished_at ?? undefined,
      updatedAt: row.updated_at as unknown as Date,
    };
  }
}
