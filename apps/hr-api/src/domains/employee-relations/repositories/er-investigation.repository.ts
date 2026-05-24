import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { ErInvestigation, type ErInvestigationStatus } from '../aggregates/er-investigation.aggregate.js';

@Injectable()
export class ErInvestigationRepository extends BaseRepository<'er_investigations', ErInvestigation> {
  protected readonly tableName = 'er_investigations' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<ErInvestigation | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['er_investigations']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<ErInvestigation[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['er_investigations']));
  }



  async save(entity: ErInvestigation): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['er_investigations']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['er_investigations']>);
    }
  }

  private toAggregate(row: Database['er_investigations']): ErInvestigation {
    return new ErInvestigation({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      erCaseId: new Uuid(row.er_case_id),
      leadInvestigatorId: new Uuid(row.investigator_id),
      findings: typeof row.findings === 'string' ? row.findings : undefined,
      status: row.status as ErInvestigationStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: ErInvestigation): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      er_case_id: entity.erCaseId.value,
      investigator_id: entity.leadInvestigatorId.value,
      findings: entity.findings ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
