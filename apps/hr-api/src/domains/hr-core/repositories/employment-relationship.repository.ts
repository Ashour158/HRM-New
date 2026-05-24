import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import {
  EmploymentRelationship,
  type EmploymentRelationshipState,
} from '../aggregates/employment-relationship.aggregate.js';

/**
 * Repository for {@link EmploymentRelationship} aggregates.
 */
@Injectable()
export class EmploymentRelationshipRepository extends BaseRepository<'employment_relationships', EmploymentRelationship> {
  protected readonly tableName = 'employment_relationships' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<EmploymentRelationship | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['employment_relationships']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<EmploymentRelationship[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['employment_relationships']));
  }

  async save(entity: EmploymentRelationship): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['employment_relationships']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['employment_relationships']>);
    }
  }

  private toAggregate(row: Database['employment_relationships']): EmploymentRelationship {
    return new EmploymentRelationship({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      relationshipType: row.relationship_type,
      startDate: row.start_date,
      endDate: row.end_date ?? undefined,
      legalEntityId: row.legal_entity_id ? new Uuid(row.legal_entity_id) : undefined,
      contractType: row.contract_type ?? undefined,
      probationEndDate: row.probation_end_date ?? undefined,
      state: row.state as EmploymentRelationshipState,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: EmploymentRelationship): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      relationship_type: entity.relationshipType,
      start_date: entity.startDate,
      end_date: entity.endDate ?? null,
      legal_entity_id: entity.legalEntityId?.value ?? null,
      contract_type: entity.contractType ?? null,
      probation_end_date: entity.probationEndDate ?? null,
      state: entity.state,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
