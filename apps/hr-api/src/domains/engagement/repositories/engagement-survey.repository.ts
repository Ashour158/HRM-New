import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { EngagementSurvey, type EngagementSurveyStatus } from '../aggregates/engagement-survey.aggregate.js';

@Injectable()
export class EngagementSurveyRepository extends BaseRepository<'engagement_surveys', EngagementSurvey> {
  protected readonly tableName = 'engagement_surveys' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<EngagementSurvey | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<EngagementSurvey[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: EngagementSurvey): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): EngagementSurvey {
    return new EngagementSurvey({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      title: row.title,
      surveyType: row.survey_type,
      questions: (row.questions as Record<string, unknown>[]) ?? [],
      anonymous: row.anonymous ?? false,
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      results: (row.results as Record<string, unknown>) ?? undefined,
      status: (row.status as EngagementSurveyStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: EngagementSurvey): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      title: entity.title,
      survey_type: entity.surveyType,
      questions: entity.questions,
      anonymous: entity.anonymous,
      start_date: entity.startDate ?? null,
      end_date: entity.endDate ?? null,
      results: entity.results ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
