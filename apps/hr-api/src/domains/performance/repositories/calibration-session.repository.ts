import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { CalibrationSession, type CalibrationSessionStatus } from '../aggregates/calibration-session.aggregate.js';

@Injectable()
export class CalibrationSessionRepository extends BaseRepository<'calibration_sessions', CalibrationSession> {
  protected readonly tableName = 'calibration_sessions' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<CalibrationSession | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByReviewCycle(reviewCycleId: Uuid): Promise<CalibrationSession[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('review_cycle_id', '=', reviewCycleId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: CalibrationSession): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): CalibrationSession {
    return new CalibrationSession({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      reviewCycleId: new Uuid(row.review_cycle_id),
      facilitatorId: new Uuid(row.facilitator_id),
      participants: (row.participants as string[]) ?? [],
      ratingsMatrix: (row.ratings_matrix as Record<string, unknown>) ?? {},
      status: (row.status as CalibrationSessionStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: CalibrationSession): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      review_cycle_id: entity.reviewCycleId.value,
      facilitator_id: entity.facilitatorId.value,
      participants: JSON.stringify(entity.participants),
      ratings_matrix: JSON.stringify(entity.ratingsMatrix),
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
