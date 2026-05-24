import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { LearningCourse, type LearningCourseStatus } from '../aggregates/learning-course.aggregate.js';

@Injectable()
export class LearningCourseRepository extends BaseRepository<any, LearningCourse> {
  protected readonly tableName = 'learning_courses' as any;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<LearningCourse | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as any) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<LearningCourse[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as any));
  }

  async save(entity: LearningCourse): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as any);
    } else {
      await this.insert(row as unknown as any);
    }
  }

  private toAggregate(row: any): LearningCourse {
    return new LearningCourse({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      title: row.title,
      description: row.description ?? undefined,
      contentType: row.content_type,
      durationMinutes: row.duration_minutes ?? undefined,
      credits: row.credits ?? undefined,
      certificationEligible: row.certification_eligible ?? false,
      status: (row.status as LearningCourseStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: LearningCourse): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      title: entity.title,
      description: entity.description ?? null,
      content_type: entity.contentType,
      duration_minutes: entity.durationMinutes ?? null,
      credits: entity.credits ?? null,
      certification_eligible: entity.certificationEligible,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
