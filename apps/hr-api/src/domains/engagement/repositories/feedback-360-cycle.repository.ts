import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { Feedback360Cycle, type Feedback360CycleStatus } from '../aggregates/feedback-360-cycle.aggregate.js';

@Injectable()
export class Feedback360CycleRepository extends BaseRepository<any, Feedback360Cycle> {
  protected readonly tableName = 'feedback_360_cycles' as any;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<Feedback360Cycle | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as any) : undefined;
  }

  async findBySubjectWorker(subjectWorkerId: Uuid): Promise<Feedback360Cycle[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('subject_worker_id', '=', subjectWorkerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as any));
  }

  async save(entity: Feedback360Cycle): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as any);
    } else {
      await this.insert(row as unknown as any);
    }
  }

  private toAggregate(row: any): Feedback360Cycle {
    return new Feedback360Cycle({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      subjectWorkerId: new Uuid(row.subject_worker_id),
      reviewers: (row.reviewers as string[]) ?? [],
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      status: (row.status as Feedback360CycleStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: Feedback360Cycle): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      subject_worker_id: entity.subjectWorkerId.value,
      reviewers: entity.reviewers,
      start_date: entity.startDate ?? null,
      end_date: entity.endDate ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
