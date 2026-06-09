import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { MentalHealthCase, type MentalHealthCaseStatus } from '../aggregates/mental-health-case.aggregate.js';

@Injectable()
export class MentalHealthCaseRepository extends BaseRepository<'mental_health_cases', MentalHealthCase> {
  protected readonly tableName = 'mental_health_cases' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<MentalHealthCase | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['mental_health_cases']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<MentalHealthCase[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['mental_health_cases']));
  }



  async save(entity: MentalHealthCase): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['mental_health_cases']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['mental_health_cases']>);
    }
  }

  private toAggregate(row: Database['mental_health_cases']): MentalHealthCase {
    return new MentalHealthCase({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      severity: row.severity,
      status: row.status as MentalHealthCaseStatus,
      providerId: row.provider_id ? new Uuid(row.provider_id) : undefined,
      notes: row.notes ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: MentalHealthCase): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      severity: entity.severity,
      status: entity.status,
      provider_id: entity.providerId?.value ?? null,
      notes: entity.notes ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
