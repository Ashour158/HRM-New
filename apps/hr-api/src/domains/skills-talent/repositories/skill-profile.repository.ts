import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { SkillProfile, type SkillProfileStatus } from '../aggregates/skill-profile.aggregate.js';

@Injectable()
export class SkillProfileRepository extends BaseRepository<any, SkillProfile> {
  protected readonly tableName = 'skill_profiles' as any;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<SkillProfile | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as any) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<SkillProfile | undefined> {
    const row = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).executeTakeFirst();
    return row ? this.toAggregate(row as unknown as any) : undefined;
  }

  async save(entity: SkillProfile): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as any);
    } else {
      await this.insert(row as unknown as any);
    }
  }

  private toAggregate(row: any): SkillProfile {
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
      skills: entity.skills.map((s) => ({
        skillId: s.skillId,
        proficiency: s.proficiency,
        validatedBy: s.validatedBy?.value,
        validatedAt: s.validatedAt?.toISOString(),
      })),
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
