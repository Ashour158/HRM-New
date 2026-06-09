import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { AttendanceLedgerSnapshotRecord } from '../services/attendance-finalization.service.js';

export type AttendanceDailyLedgerStoredRecord = AttendanceLedgerSnapshotRecord & {
  id: string;
  aggregateVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

function workDateToDb(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function workDateFromDb(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class AttendanceDailyLedgerRepository {
  private readonly db = createKyselyInstance(getPool());
  private readonly tableName = 'attendance_daily_ledgers' as const;

  async findByDate(tenantId: Uuid, workDate: string): Promise<AttendanceDailyLedgerStoredRecord[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('work_date', '=', workDateToDb(workDate))
      .execute();
    return rows.map((row: any) => this.toRecord(row as Database['attendance_daily_ledgers']));
  }

  async findByWorker(tenantId: Uuid, workerId: Uuid, options?: { dateFrom?: string; dateTo?: string }): Promise<AttendanceDailyLedgerStoredRecord[]> {
    let query = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('worker_id', '=', workerId.value);

    if (options?.dateFrom) query = query.where('work_date', '>=', workDateToDb(options.dateFrom));
    if (options?.dateTo) query = query.where('work_date', '<=', workDateToDb(options.dateTo));

    const rows = await query.orderBy('work_date', 'desc').execute();
    return rows.map((row: any) => this.toRecord(row as Database['attendance_daily_ledgers']));
  }

  async saveMany(records: AttendanceLedgerSnapshotRecord[]): Promise<AttendanceDailyLedgerStoredRecord[]> {
    if (records.length === 0) return [];
    const now = new Date();
    const rows = records.map((record) => ({
      id: Uuid.generate().value,
      tenant_id: record.tenantId,
      worker_id: record.workerId,
      employee_id: record.employeeId,
      worker_name: record.workerName,
      work_date: workDateToDb(record.workDate),
      status: record.status,
      scheduled: record.scheduled,
      holiday_name: record.holidayName ?? null,
      first_check_in_at: record.firstCheckInAt ?? null,
      latest_check_out_at: record.latestCheckOutAt ?? null,
      location_status: record.locationStatus,
      worked_minutes: record.workedMinutes,
      payable_minutes: record.payableMinutes,
      deduction_minutes: record.deductionMinutes,
      overtime_minutes: record.overtimeMinutes,
      late_minutes: record.lateMinutes,
      undertime_minutes: record.undertimeMinutes,
      exception_count: record.exceptionCount,
      ready_for_payroll: record.readyForPayroll,
      locked: record.locked,
      locked_at: record.lockedAt,
      locked_by: record.lockedBy,
      payroll_cycle_id: record.payrollCycleId ?? null,
      source_hash: record.sourceHash,
      ledger_payload: record.ledgerPayload,
      payroll_payload: record.payrollPayload,
      governance: record.governance,
      aggregate_version: 0,
      created_at: now,
      updated_at: now,
    } satisfies Insertable<Database['attendance_daily_ledgers']>));

    const savedRows = await this.db
      .insertInto(this.tableName)
      .values(rows)
      .onConflict((oc: any) => oc
        .columns(['tenant_id', 'worker_id', 'work_date'])
        .doUpdateSet((eb: any) => ({
          employee_id: eb.ref('excluded.employee_id'),
          worker_name: eb.ref('excluded.worker_name'),
          status: eb.ref('excluded.status'),
          scheduled: eb.ref('excluded.scheduled'),
          holiday_name: eb.ref('excluded.holiday_name'),
          first_check_in_at: eb.ref('excluded.first_check_in_at'),
          latest_check_out_at: eb.ref('excluded.latest_check_out_at'),
          location_status: eb.ref('excluded.location_status'),
          worked_minutes: eb.ref('excluded.worked_minutes'),
          payable_minutes: eb.ref('excluded.payable_minutes'),
          deduction_minutes: eb.ref('excluded.deduction_minutes'),
          overtime_minutes: eb.ref('excluded.overtime_minutes'),
          late_minutes: eb.ref('excluded.late_minutes'),
          undertime_minutes: eb.ref('excluded.undertime_minutes'),
          exception_count: eb.ref('excluded.exception_count'),
          ready_for_payroll: eb.ref('excluded.ready_for_payroll'),
          locked: eb.ref('excluded.locked'),
          locked_at: eb.ref('excluded.locked_at'),
          locked_by: eb.ref('excluded.locked_by'),
          payroll_cycle_id: eb.ref('excluded.payroll_cycle_id'),
          source_hash: eb.ref('excluded.source_hash'),
          ledger_payload: eb.ref('excluded.ledger_payload'),
          payroll_payload: eb.ref('excluded.payroll_payload'),
          governance: eb.ref('excluded.governance'),
          aggregate_version: eb.ref('excluded.aggregate_version'),
          updated_at: now,
        })))
      .returningAll()
      .execute();

    return savedRows.map((row: any) => this.toRecord(row as Database['attendance_daily_ledgers']));
  }

  private toRecord(row: Database['attendance_daily_ledgers']): AttendanceDailyLedgerStoredRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      workerId: row.worker_id,
      employeeId: row.employee_id,
      workerName: row.worker_name,
      workDate: workDateFromDb(row.work_date),
      status: row.status as AttendanceLedgerSnapshotRecord['status'],
      scheduled: row.scheduled,
      holidayName: row.holiday_name ?? undefined,
      firstCheckInAt: row.first_check_in_at ?? undefined,
      latestCheckOutAt: row.latest_check_out_at ?? undefined,
      locationStatus: row.location_status,
      workedMinutes: row.worked_minutes,
      payableMinutes: row.payable_minutes,
      deductionMinutes: row.deduction_minutes,
      overtimeMinutes: row.overtime_minutes,
      lateMinutes: row.late_minutes,
      undertimeMinutes: row.undertime_minutes,
      exceptionCount: row.exception_count,
      readyForPayroll: row.ready_for_payroll,
      locked: row.locked,
      lockedAt: row.locked_at ?? new Date(0),
      lockedBy: row.locked_by ?? '',
      payrollCycleId: row.payroll_cycle_id ?? undefined,
      sourceHash: row.source_hash,
      payrollPayload: row.payroll_payload as AttendanceLedgerSnapshotRecord['payrollPayload'],
      ledgerPayload: row.ledger_payload as AttendanceLedgerSnapshotRecord['ledgerPayload'],
      governance: row.governance as AttendanceLedgerSnapshotRecord['governance'],
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
