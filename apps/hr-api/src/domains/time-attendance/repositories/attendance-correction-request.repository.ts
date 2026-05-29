import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type {
  AttendanceCorrectionAuditEntry,
  AttendanceCorrectionRequestRecord,
  AttendanceCorrectionStatus,
  AttendanceCorrectionType,
} from '../services/attendance-correction.service.js';
import type { TimeClockEventType } from '../aggregates/time-clock-event.aggregate.js';

function workDateToDb(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function workDateFromDb(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class AttendanceCorrectionRequestRepository {
  private readonly db = createKyselyInstance(getPool());
  private readonly tableName = 'attendance_correction_requests' as const;

  async create(record: Omit<AttendanceCorrectionRequestRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<AttendanceCorrectionRequestRecord> {
    const now = new Date();
    const row = await this.db
      .insertInto(this.tableName)
      .values({
        id: record.id ?? Uuid.generate().value,
        tenant_id: record.tenantId,
        worker_id: record.workerId,
        work_date: workDateToDb(record.workDate),
        correction_type: record.correctionType,
        requested_event_type: record.requestedEventType ?? null,
        requested_timestamp: record.requestedTimestamp ?? null,
        target_event_id: record.targetEventId ?? null,
        reason: record.reason,
        status: record.status,
        requested_by: record.requestedBy,
        requested_at: record.requestedAt,
        reviewed_by: record.reviewedBy ?? null,
        reviewed_at: record.reviewedAt ?? null,
        applied_by: record.appliedBy ?? null,
        applied_at: record.appliedAt ?? null,
        applied_event_id: record.appliedEventId ?? null,
        audit_trail: record.auditTrail,
        aggregate_version: 0,
        created_at: now,
        updated_at: now,
      } satisfies Insertable<Database['attendance_correction_requests']>)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.toRecord(row as Database['attendance_correction_requests']);
  }

  async findById(id: Uuid): Promise<AttendanceCorrectionRequestRecord | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toRecord(row as Database['attendance_correction_requests']) : undefined;
  }

  async findByWorker(tenantId: Uuid, workerId: Uuid, options?: { dateFrom?: string; dateTo?: string }): Promise<AttendanceCorrectionRequestRecord[]> {
    let query = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('worker_id', '=', workerId.value);

    if (options?.dateFrom) query = query.where('work_date', '>=', workDateToDb(options.dateFrom));
    if (options?.dateTo) query = query.where('work_date', '<=', workDateToDb(options.dateTo));

    const rows = await query.orderBy('requested_at', 'desc').execute();
    return rows.map((row) => this.toRecord(row as Database['attendance_correction_requests']));
  }

  async findQueue(tenantId: Uuid, options?: { status?: AttendanceCorrectionStatus; workDate?: string }): Promise<AttendanceCorrectionRequestRecord[]> {
    let query = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value);
    if (options?.status) query = query.where('status', '=', options.status);
    if (options?.workDate) query = query.where('work_date', '=', workDateToDb(options.workDate));
    const rows = await query.orderBy('requested_at', 'desc').execute();
    return rows.map((row) => this.toRecord(row as Database['attendance_correction_requests']));
  }

  async save(record: AttendanceCorrectionRequestRecord): Promise<AttendanceCorrectionRequestRecord> {
    const row = await this.db
      .updateTable(this.tableName)
      .set({
        status: record.status,
        reviewed_by: record.reviewedBy ?? null,
        reviewed_at: record.reviewedAt ?? null,
        applied_by: record.appliedBy ?? null,
        applied_at: record.appliedAt ?? null,
        applied_event_id: record.appliedEventId ?? null,
        audit_trail: record.auditTrail,
        aggregate_version: 0,
        updated_at: record.updatedAt,
      })
      .where('id', '=', record.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toRecord(row as Database['attendance_correction_requests']);
  }

  private toRecord(row: Database['attendance_correction_requests']): AttendanceCorrectionRequestRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      workerId: row.worker_id,
      workDate: workDateFromDb(row.work_date),
      correctionType: row.correction_type as AttendanceCorrectionType,
      requestedEventType: row.requested_event_type ? row.requested_event_type as TimeClockEventType : undefined,
      requestedTimestamp: row.requested_timestamp ?? undefined,
      targetEventId: row.target_event_id ?? undefined,
      reason: row.reason,
      status: row.status as AttendanceCorrectionStatus,
      requestedBy: row.requested_by,
      requestedAt: row.requested_at,
      reviewedBy: row.reviewed_by ?? undefined,
      reviewedAt: row.reviewed_at ?? undefined,
      appliedBy: row.applied_by ?? undefined,
      appliedAt: row.applied_at ?? undefined,
      appliedEventId: row.applied_event_id ?? undefined,
      auditTrail: row.audit_trail as AttendanceCorrectionAuditEntry[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
