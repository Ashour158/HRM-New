import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { AbsenceRequest, type AbsenceDurationUnit, type AbsencePayrollImpact, type AbsenceRequestStatus } from '../aggregates/absence-request.aggregate.js';

@Injectable()
export class AbsenceRequestRepository extends BaseRepository<'absence_requests', AbsenceRequest> {
  protected readonly tableName = 'absence_requests' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<AbsenceRequest | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['absence_requests']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<AbsenceRequest[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['absence_requests']));
  }

  async findByTenant(tenantId: Uuid, status?: AbsenceRequestStatus): Promise<AbsenceRequest[]> {
    let query = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value);

    if (status) {
      query = query.where('status', '=', status);
    }

    const rows = await query.orderBy('created_at', 'desc').execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['absence_requests']));
  }

  async findApprovedOverlapping(
    tenantId: Uuid,
    startDate: string,
    endDate: string,
    workerIds?: string[],
  ): Promise<AbsenceRequest[]> {
    let query = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('status', '=', 'APPROVED')
      .where('start_date', '<=', new Date(`${endDate}T00:00:00.000Z`))
      .where('end_date', '>=', new Date(`${startDate}T00:00:00.000Z`));

    if (workerIds && workerIds.length > 0) {
      query = query.where('worker_id', 'in', workerIds);
    }

    const rows = await query.orderBy('start_date', 'asc').execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['absence_requests']));
  }

  async findOverlappingByWorker(
    tenantId: Uuid,
    workerId: Uuid,
    startDate: Date,
    endDate: Date,
    statuses: AbsenceRequestStatus[],
  ): Promise<AbsenceRequest[]> {
    if (statuses.length === 0) return [];
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('worker_id', '=', workerId.value)
      .where('status', 'in', statuses)
      .where('start_date', '<=', endDate)
      .where('end_date', '>=', startDate)
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['absence_requests']));
  }

  async save(entity: AbsenceRequest): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['absence_requests']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['absence_requests']>);
    }
  }

  private toAggregate(row: Database['absence_requests']): AbsenceRequest {
    return new AbsenceRequest({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      absenceType: row.absence_type,
      policyCode: row.policy_code ?? undefined,
      startDate: row.start_date,
      endDate: row.end_date,
      durationUnit: row.duration_unit as AbsenceDurationUnit,
      durationAmount: Number(row.duration_amount),
      startTime: row.start_time ?? undefined,
      endTime: row.end_time ?? undefined,
      paid: row.paid,
      deductFromBalance: row.deduct_from_balance,
      payrollImpact: row.payroll_impact as AbsencePayrollImpact,
      calendarDays: row.calendar_days,
      workingDays: Number(row.working_days),
      excludedHolidayDates: this.parseHolidayDates(row.excluded_holiday_dates),
      reason: row.reason ?? undefined,
      status: row.status as AbsenceRequestStatus,
      submittedAt: row.submitted_at ?? undefined,
      approvedBy: row.approved_by ? new Uuid(row.approved_by) : undefined,
      approvedAt: row.approved_at ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: AbsenceRequest): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      absence_type: entity.absenceType,
      policy_code: entity.policyCode ?? null,
      start_date: entity.startDate,
      end_date: entity.endDate,
      duration_unit: entity.durationUnit,
      duration_amount: entity.durationAmount,
      start_time: entity.startTime ?? null,
      end_time: entity.endTime ?? null,
      paid: entity.paid,
      deduct_from_balance: entity.deductFromBalance,
      payroll_impact: entity.payrollImpact,
      calendar_days: entity.calendarDays,
      working_days: entity.workingDays,
      excluded_holiday_dates: JSON.stringify(entity.excludedHolidayDates),
      reason: entity.reason ?? null,
      status: entity.status,
      submitted_at: entity.submittedAt ?? null,
      approved_by: entity.approvedBy?.value ?? null,
      approved_at: entity.approvedAt ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }

  private parseHolidayDates(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
}
