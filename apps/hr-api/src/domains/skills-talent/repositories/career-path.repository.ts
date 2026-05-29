import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { CareerPath, type CareerPathStatus } from '../aggregates/career-path.aggregate.js';

@Injectable()
export class CareerPathRepository extends BaseRepository<'career_paths', CareerPath> {
  protected readonly tableName = 'career_paths' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<CareerPath | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<CareerPath[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: CareerPath): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): CareerPath {
    return new CareerPath({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      title: row.title,
      currentRole: row.current_role,
      targetRole: row.target_role,
      requiredSkills: (row.required_skills as string[]) ?? [],
      milestones: (row.milestones as unknown as { milestoneId: string; title: string; requiredSkills: string[]; achievedAt?: string }[] | undefined)?.map((m) => ({
        milestoneId: m.milestoneId,
        title: m.title,
        requiredSkills: m.requiredSkills,
        achievedAt: m.achievedAt ? new Date(m.achievedAt) : undefined,
      })) ?? [],
      status: (row.status as CareerPathStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: CareerPath): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      title: entity.title,
      current_role: entity.currentRole,
      target_role: entity.targetRole,
      required_skills: entity.requiredSkills,
      milestones: entity.milestones.map((m) => ({
        milestoneId: m.milestoneId,
        title: m.title,
        requiredSkills: m.requiredSkills,
        achievedAt: m.achievedAt?.toISOString(),
      })),
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
