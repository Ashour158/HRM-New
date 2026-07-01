import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { SkillProfile, type SkillProfileStatus } from '../aggregates/skill-profile.aggregate.js';

@Injectable()
export class SkillProfileRepository extends BaseRepository<'skill_profiles', SkillProfile> {
  protected readonly tableName = 'skill_profiles' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for skill profile query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<SkillProfile | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<SkillProfile | undefined> {
    const row = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value).executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<SkillProfile[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: SkillProfile): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): SkillProfile {
    return new SkillProfile({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      skills: (row.skills as unknown as { skillId: string; proficiency: number; validatedBy?: string; validatedAt?: string }[] | undefined)?.map((s) => ({
        skillId: s.skillId,
        proficiency: s.proficiency,
        validatedBy: s.validatedBy ? new Uuid(s.validatedBy) : undefined,
        validatedAt: s.validatedAt ? new Date(s.validatedAt) : undefined,
      })) ?? [],
      status: (row.status as SkillProfileStatus) ?? 'ACTIVE',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: SkillProfile): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      skills: JSON.stringify(entity.skills.map((s) => ({
        skillId: s.skillId,
        proficiency: s.proficiency,
        validatedBy: s.validatedBy?.value,
        validatedAt: s.validatedAt?.toISOString(),
      }))),
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
