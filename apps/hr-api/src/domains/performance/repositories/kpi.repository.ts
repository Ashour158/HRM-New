import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId, parseNullableNumeric } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { KeyPerformanceIndicator, type KpiStatus } from '../aggregates/kpi.aggregate.js';

@Injectable()
export class KpiRepository extends BaseRepository<'kpis', KeyPerformanceIndicator> {
  protected readonly tableName = 'kpis' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for kpi query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<KeyPerformanceIndicator | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByOrgUnit(orgUnitId: Uuid): Promise<KeyPerformanceIndicator[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('org_unit_id', '=', orgUnitId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByDepartment(department: string): Promise<KeyPerformanceIndicator[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('department', '=', department).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: KeyPerformanceIndicator): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): KeyPerformanceIndicator {
    return new KeyPerformanceIndicator({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      orgUnitId: row.org_unit_id ? new Uuid(row.org_unit_id) : undefined,
      name: row.name,
      description: row.description ?? undefined,
      targetValue: parseNullableNumeric(row.target_value),
      actualValue: parseNullableNumeric(row.actual_value),
      unit: row.unit ?? undefined,
      frequency: row.frequency ?? 'MONTHLY',
      ownerId: row.owner_id ? new Uuid(row.owner_id) : undefined,
      formula: row.formula ?? undefined,
      dataSource: row.data_source ?? undefined,
      department: row.department ?? undefined,
      status: (row.status as KpiStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: KeyPerformanceIndicator): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      org_unit_id: entity.orgUnitId?.value ?? null,
      name: entity.name,
      description: entity.description ?? null,
      target_value: entity.targetValue ?? null,
      actual_value: entity.actualValue ?? null,
      unit: entity.unit ?? null,
      frequency: entity.frequency,
      owner_id: entity.ownerId?.value ?? null,
      formula: entity.formula ?? null,
      data_source: entity.dataSource ?? null,
      department: entity.department ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
