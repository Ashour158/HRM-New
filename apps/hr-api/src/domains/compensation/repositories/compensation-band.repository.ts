import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import { CompensationBand } from '../aggregates/compensation-band.aggregate.js';

/**
 * Repository for {@link CompensationBand} aggregates.
 */
@Injectable()
export class CompensationBandRepository extends BaseRepository<'compensation_bands', CompensationBand> {
  protected readonly tableName = 'compensation_bands' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<CompensationBand | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['compensation_bands']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<CompensationBand[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['compensation_bands']));
  }

  async findByJobFamily(jobFamily: string): Promise<CompensationBand[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('job_family', '=', jobFamily)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['compensation_bands']));
  }

  async save(entity: CompensationBand): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['compensation_bands']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['compensation_bands']>);
    }
  }

  private toAggregate(row: Database['compensation_bands']): CompensationBand {
    return new CompensationBand({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      bandCode: row.band_code,
      jobLevel: row.job_level,
      jobFamily: row.job_family,
      minSalary: row.min_salary,
      midSalary: row.mid_salary,
      maxSalary: row.max_salary,
      currency: row.currency,
      status: row.status as 'DRAFT' | 'ACTIVE' | 'REVISED' | 'CLOSED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: CompensationBand): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      band_code: entity.bandCode,
      job_level: entity.jobLevel,
      job_family: entity.jobFamily,
      min_salary: entity.minSalary,
      mid_salary: entity.midSalary,
      max_salary: entity.maxSalary,
      currency: entity.currency,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
