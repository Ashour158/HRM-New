import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { RecognitionRecord, type RecognitionRecordStatus } from '../aggregates/recognition-record.aggregate.js';

@Injectable()
export class RecognitionRecordRepository extends BaseRepository<'recognition_records', RecognitionRecord> {
  protected readonly tableName = 'recognition_records' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<RecognitionRecord | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<RecognitionRecord[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('to_worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: RecognitionRecord): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): RecognitionRecord {
    return new RecognitionRecord({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      fromWorkerId: new Uuid(row.from_worker_id),
      toWorkerId: new Uuid(row.to_worker_id),
      programId: new Uuid(row.program_id),
      points: row.points ?? undefined,
      message: row.message ?? undefined,
      approvedBy: row.approved_by ? new Uuid(row.approved_by) : undefined,
      status: (row.status as RecognitionRecordStatus) ?? 'SUBMITTED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: RecognitionRecord): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      from_worker_id: entity.fromWorkerId.value,
      to_worker_id: entity.toWorkerId.value,
      program_id: entity.programId.value,
      points: entity.points ?? null,
      message: entity.message ?? null,
      approved_by: entity.approvedBy?.value ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
