import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { PerformanceReview, type PerformanceReviewStatus } from '../aggregates/performance-review.aggregate.js';

@Injectable()
export class PerformanceReviewRepository extends BaseRepository<'performance_reviews', PerformanceReview> {
  protected readonly tableName = 'performance_reviews' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<PerformanceReview | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<PerformanceReview[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByReviewCycle(reviewCycleId: Uuid): Promise<PerformanceReview[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('review_cycle_id', '=', reviewCycleId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: PerformanceReview): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): PerformanceReview {
    return new PerformanceReview({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      reviewCycleId: new Uuid(row.review_cycle_id),
      managerId: new Uuid(row.manager_id),
      selfReviewContent: row.self_review_content ?? undefined,
      managerReviewContent: row.manager_review_content ?? undefined,
      calibratedRating: row.calibrated_rating ?? undefined,
      finalRating: row.final_rating ?? undefined,
      status: (row.status as PerformanceReviewStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: PerformanceReview): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      review_cycle_id: entity.reviewCycleId.value,
      manager_id: entity.managerId.value,
      self_review_content: entity.selfReviewContent ?? null,
      manager_review_content: entity.managerReviewContent ?? null,
      calibrated_rating: entity.calibratedRating ?? null,
      final_rating: entity.finalRating ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
