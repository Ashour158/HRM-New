import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { WellnessProgram, type WellnessProgramStatus } from '../aggregates/wellness-program.aggregate.js';

@Injectable()
export class WellnessProgramRepository extends BaseRepository<'wellness_programs', WellnessProgram> {
  protected readonly tableName = 'wellness_programs' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<WellnessProgram | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['wellness_programs']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<WellnessProgram[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['wellness_programs']));
  }



  async save(entity: WellnessProgram): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['wellness_programs']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['wellness_programs']>);
    }
  }

  private toAggregate(row: Database['wellness_programs']): WellnessProgram {
    return new WellnessProgram({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      name: row.name,
      type: row.type,
      status: row.status as WellnessProgramStatus,
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      description: row.description ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: WellnessProgram): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      name: entity.name,
      type: entity.type,
      status: entity.status,
      start_date: entity.startDate ?? null,
      end_date: entity.endDate ?? null,
      description: entity.description ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
