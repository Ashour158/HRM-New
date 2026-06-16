import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { Competency, type CompetencyStatus } from '../aggregates/competency.aggregate.js';

@Injectable()
export class CompetencyRepository extends BaseRepository<'competencies', Competency> {
  protected readonly tableName = 'competencies' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for competencie query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<Competency | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<Competency[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByCategory(category: string): Promise<Competency[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('category', '=', category).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: Competency): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): Competency {
    return new Competency({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      name: row.name,
      description: row.description ?? undefined,
      category: row.category,
      behavioralIndicators: row.behavioral_indicators ?? [],
      proficiencyLevels: row.proficiency_levels ?? [],
      applicableDepartment: row.applicable_department ?? undefined,
      status: (row.status as CompetencyStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: Competency): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      name: entity.name,
      description: entity.description ?? null,
      category: entity.category,
      behavioral_indicators: JSON.stringify(entity.behavioralIndicators ?? []),
      proficiency_levels: JSON.stringify(entity.proficiencyLevels ?? []),
      applicable_department: entity.applicableDepartment ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
