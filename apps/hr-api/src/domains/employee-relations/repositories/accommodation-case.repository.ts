import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { AccommodationCase, type AccommodationCaseStatus } from '../aggregates/accommodation-case.aggregate.js';

@Injectable()
export class AccommodationCaseRepository extends BaseRepository<'accommodation_cases', AccommodationCase> {
  protected readonly tableName = 'accommodation_cases' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<AccommodationCase | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['accommodation_cases']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<AccommodationCase[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['accommodation_cases']));
  }



  async save(entity: AccommodationCase): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['accommodation_cases']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['accommodation_cases']>);
    }
  }

  private toAggregate(row: Database['accommodation_cases']): AccommodationCase {
    return new AccommodationCase({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      requestType: row.request_type,
      description: '',
      medicalDocumentation: row.medical_documentation ?? undefined,
      status: row.status as AccommodationCaseStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: AccommodationCase): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      request_type: entity.requestType,
      medical_documentation: entity.medicalDocumentation ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
