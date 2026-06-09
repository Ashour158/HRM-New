import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { Objective, type ObjectiveStatus } from '../aggregates/objective.aggregate.js';

@Injectable()
export class ObjectiveRepository extends BaseRepository<'objectives', Objective> {
  protected readonly tableName = 'objectives' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<Objective | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByOwner(ownerId: Uuid): Promise<Objective[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('owner_id', '=', ownerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByOrgUnit(orgUnitId: Uuid): Promise<Objective[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('org_unit_id', '=', orgUnitId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByReviewCycle(reviewCycleId: Uuid): Promise<Objective[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('review_cycle_id', '=', reviewCycleId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByParent(parentObjectiveId: Uuid): Promise<Objective[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('parent_objective_id', '=', parentObjectiveId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: Objective): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): Objective {
    return new Objective({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      ownerId: new Uuid(row.owner_id),
      orgUnitId: row.org_unit_id ? new Uuid(row.org_unit_id) : undefined,
      parentObjectiveId: row.parent_objective_id ? new Uuid(row.parent_objective_id) : undefined,
      reviewCycleId: row.review_cycle_id ? new Uuid(row.review_cycle_id) : undefined,
      title: row.title,
      description: row.description ?? undefined,
      period: row.period,
      confidenceScore: row.confidence_score ?? undefined,
      progress: row.progress ?? 0,
      status: (row.status as ObjectiveStatus) ?? 'DRAFT',
      alignmentType: row.alignment_type ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: Objective): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      owner_id: entity.ownerId.value,
      org_unit_id: entity.orgUnitId?.value ?? null,
      parent_objective_id: entity.parentObjectiveId?.value ?? null,
      review_cycle_id: entity.reviewCycleId?.value ?? null,
      title: entity.title,
      description: entity.description ?? null,
      period: entity.period,
      confidence_score: entity.confidenceScore ?? null,
      progress: entity.progress,
      status: entity.status,
      alignment_type: entity.alignmentType ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
