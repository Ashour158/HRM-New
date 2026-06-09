import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { HrCaseSlaInstance, type HrCaseSlaInstanceStatus } from '../aggregates/hr-case-sla-instance.aggregate.js';

@Injectable()
export class HrCaseSlaInstanceRepository extends BaseRepository<'hr_case_sla_instances', HrCaseSlaInstance> {
  protected readonly tableName = 'hr_case_sla_instances' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<HrCaseSlaInstance | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['hr_case_sla_instances']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<HrCaseSlaInstance[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['hr_case_sla_instances']));
  }



  async save(entity: HrCaseSlaInstance): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['hr_case_sla_instances']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['hr_case_sla_instances']>);
    }
  }

  private toAggregate(row: Database['hr_case_sla_instances']): HrCaseSlaInstance {
    return new HrCaseSlaInstance({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      caseId: new Uuid(row.case_id),
      slaDefinitionId: new Uuid(row.sla_definition_id),
      deadlineAt: row.created_at,
      breachedAt: row.breached_at ?? undefined,
      status: row.status as HrCaseSlaInstanceStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: HrCaseSlaInstance): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      case_id: entity.caseId.value,
      sla_definition_id: entity.slaDefinitionId.value,
      target_hours: 0,
      started_at: entity.createdAt ?? new Date(),
      breached_at: entity.breachedAt ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
