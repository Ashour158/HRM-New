import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { CoverageGap, type CoverageGapStatus } from '../aggregates/coverage-gap.aggregate.js';

@Injectable()
export class CoverageGapRepository extends BaseRepository<'coverage_gaps', CoverageGap> {
  protected readonly tableName = 'coverage_gaps' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<CoverageGap | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['coverage_gaps']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<CoverageGap[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['coverage_gaps']));
  }

  async findByDepartment(departmentId: Uuid): Promise<CoverageGap[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('department_id', '=', departmentId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['coverage_gaps']));
  }



  async save(entity: CoverageGap): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['coverage_gaps']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['coverage_gaps']>);
    }
  }

  private toAggregate(row: Database['coverage_gaps']): CoverageGap {
    return new CoverageGap({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      departmentId: new Uuid(row.department_id),
      shiftDate: row.shift_date,
      startTime: row.gap_start,
      endTime: row.gap_end,
      status: row.status as CoverageGapStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: CoverageGap): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      department_id: entity.departmentId.value,
      shift_date: entity.shiftDate,
      gap_start: entity.startTime,
      gap_end: entity.endTime,
      unfilled_positions: 0,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
