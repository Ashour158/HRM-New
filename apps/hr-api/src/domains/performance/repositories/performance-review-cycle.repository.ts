import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { PerformanceReviewCycle, type PerformanceReviewCycleStatus } from '../aggregates/performance-review-cycle.aggregate.js';

@Injectable()
export class PerformanceReviewCycleRepository extends BaseRepository<any, PerformanceReviewCycle> {
  protected readonly tableName = 'performance_review_cycles' as any;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<PerformanceReviewCycle | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as any) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<PerformanceReviewCycle[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as any));
  }

  async save(entity: PerformanceReviewCycle): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as any);
    } else {
      await this.insert(row as unknown as any);
    }
  }

  private toAggregate(row: any): PerformanceReviewCycle {
    return new PerformanceReviewCycle({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      name: row.name,
      cycleYear: row.cycle_year,
      startDate: row.start_date,
      endDate: row.end_date,
      reviewType: row.review_type,
      status: (row.status as PerformanceReviewCycleStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: PerformanceReviewCycle): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      name: entity.name,
      cycle_year: entity.cycleYear,
      start_date: entity.startDate,
      end_date: entity.endDate,
      review_type: entity.reviewType,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
