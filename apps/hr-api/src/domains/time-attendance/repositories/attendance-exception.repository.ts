import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { AttendanceException, type AttendanceExceptionStatus } from '../aggregates/attendance-exception.aggregate.js';

@Injectable()
export class AttendanceExceptionRepository extends BaseRepository<'attendance_exceptions', AttendanceException> {
  protected readonly tableName = 'attendance_exceptions' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<AttendanceException | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['attendance_exceptions']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<AttendanceException[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['attendance_exceptions']));
  }

  async findByWorkerForTenant(tenantId: Uuid, workerId: Uuid): Promise<AttendanceException[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['attendance_exceptions']));
  }

  async save(entity: AttendanceException): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['attendance_exceptions']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['attendance_exceptions']>);
    }
  }

  private toAggregate(row: Database['attendance_exceptions']): AttendanceException {
    return new AttendanceException({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      exceptionType: row.exception_type,
      description: row.description,
      detectedAt: row.detected_at,
      resolvedAt: row.resolved_at ?? undefined,
      resolvedBy: row.resolved_by ? new Uuid(row.resolved_by) : undefined,
      status: row.status as AttendanceExceptionStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: AttendanceException): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      exception_type: entity.exceptionType,
      description: entity.description,
      detected_at: entity.detectedAt,
      resolved_at: entity.resolvedAt ?? null,
      resolved_by: entity.resolvedBy?.value ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
