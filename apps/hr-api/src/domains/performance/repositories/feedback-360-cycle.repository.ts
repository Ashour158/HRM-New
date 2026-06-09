import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { Feedback360Cycle, type Feedback360CycleStatus } from '../aggregates/feedback-360-cycle.aggregate.js';

@Injectable()
export class Feedback360CycleRepository extends BaseRepository<'performance_feedback_360_cycles', Feedback360Cycle> {
  protected readonly tableName = 'performance_feedback_360_cycles' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<Feedback360Cycle | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<Feedback360Cycle[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: Feedback360Cycle): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): Feedback360Cycle {
    return new Feedback360Cycle({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      name: row.name,
      cycleYear: row.cycle_year,
      reviewCycleId: row.review_cycle_id ? new Uuid(row.review_cycle_id) : undefined,
      startDate: row.start_date,
      endDate: row.end_date,
      selfReviewDeadline: row.self_review_deadline ?? undefined,
      peerReviewDeadline: row.peer_review_deadline ?? undefined,
      managerReviewDeadline: row.manager_review_deadline ?? undefined,
      status: (row.status as Feedback360CycleStatus) ?? 'DRAFT',
      anonymityEnabled: row.anonymity_enabled ?? true,
      minPeerReviews: row.min_peer_reviews ?? 3,
      maxPeerReviews: row.max_peer_reviews ?? 5,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: Feedback360Cycle): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      name: entity.name,
      cycle_year: entity.cycleYear,
      review_cycle_id: entity.reviewCycleId?.value ?? null,
      start_date: entity.startDate,
      end_date: entity.endDate,
      self_review_deadline: entity.selfReviewDeadline ?? null,
      peer_review_deadline: entity.peerReviewDeadline ?? null,
      manager_review_deadline: entity.managerReviewDeadline ?? null,
      status: entity.status,
      anonymity_enabled: entity.anonymityEnabled,
      min_peer_reviews: entity.minPeerReviews,
      max_peer_reviews: entity.maxPeerReviews,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
