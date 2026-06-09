import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { Feedback360Response, type Feedback360ResponseStatus } from '../aggregates/feedback-360-response.aggregate.js';
import { parseJsonRecord } from '../utils/feedback-360-records.js';

@Injectable()
export class Feedback360ResponseRepository extends BaseRepository<'performance_feedback_360_responses', Feedback360Response> {
  protected readonly tableName = 'performance_feedback_360_responses' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<Feedback360Response | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByCycle(cycleId: Uuid): Promise<Feedback360Response[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('cycle_id', '=', cycleId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByReviewee(revieweeId: Uuid): Promise<Feedback360Response[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('reviewee_id', '=', revieweeId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByReviewer(reviewerId: Uuid): Promise<Feedback360Response[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('reviewer_id', '=', reviewerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: Feedback360Response): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): Feedback360Response {
    return new Feedback360Response({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      cycleId: new Uuid(row.cycle_id),
      revieweeId: new Uuid(row.reviewee_id),
      reviewerId: new Uuid(row.reviewer_id),
      relationshipType: row.relationship_type,
      status: (row.status as Feedback360ResponseStatus) ?? 'PENDING',
      competencyScores: parseJsonRecord<number>(row.competency_scores, 'number'),
      overallRating: row.overall_rating ?? undefined,
      strengths: row.strengths ?? undefined,
      improvements: row.improvements ?? undefined,
      comments: row.comments ?? undefined,
      dimensionScores: parseJsonRecord<number>(row.dimension_scores, 'number'),
      areaComments: parseJsonRecord<string>(row.area_comments, 'string'),
      visibility: row.visibility ?? undefined,
      isAnonymous: row.is_anonymous ?? true,
      submittedAt: row.submitted_at ?? undefined,
      withdrawnAt: row.withdrawn_at ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: Feedback360Response): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      cycle_id: entity.cycleId.value,
      reviewee_id: entity.revieweeId.value,
      reviewer_id: entity.reviewerId.value,
      relationship_type: entity.relationshipType,
      status: entity.status,
      competency_scores: entity.competencyScores ? JSON.stringify(entity.competencyScores) : null,
      overall_rating: entity.overallRating ?? null,
      strengths: entity.strengths ?? null,
      improvements: entity.improvements ?? null,
      comments: entity.comments ?? null,
      dimension_scores: entity.dimensionScores ? JSON.stringify(entity.dimensionScores) : null,
      area_comments: entity.areaComments ? JSON.stringify(entity.areaComments) : null,
      visibility: entity.visibility,
      is_anonymous: entity.isAnonymous,
      submitted_at: entity.submittedAt ?? null,
      withdrawn_at: entity.withdrawnAt ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
