import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { ReviewTemplate, type ReviewTemplateStatus } from '../aggregates/review-template.aggregate.js';

@Injectable()
export class ReviewTemplateRepository extends BaseRepository<'review_templates', ReviewTemplate> {
  protected readonly tableName = 'review_templates' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<ReviewTemplate | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<ReviewTemplate[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: ReviewTemplate): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): ReviewTemplate {
    return new ReviewTemplate({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      name: row.name,
      description: row.description ?? undefined,
      templateType: row.template_type,
      sections: this.parseJson(row.sections, []),
      ratingScale: this.parseJson(row.rating_scale, undefined),
      competencies: this.parseJson(row.competencies, undefined),
      applicableRoles: this.parseJson(row.applicable_roles, undefined),
      status: (row.status as ReviewTemplateStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: ReviewTemplate): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      name: entity.name,
      description: entity.description ?? null,
      template_type: entity.templateType,
      sections: JSON.stringify(entity.sections ?? []),
      rating_scale: entity.ratingScale ? JSON.stringify(entity.ratingScale) : null,
      competencies: entity.competencies ? JSON.stringify(entity.competencies) : null,
      applicable_roles: entity.applicableRoles ? JSON.stringify(entity.applicableRoles) : null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }

  private parseJson<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined) return fallback;
    if (typeof value !== 'string') return value as T;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
}
