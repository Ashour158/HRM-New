import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { SurveyResponse, type SurveyResponseStatus } from '../aggregates/survey-response.aggregate.js';

@Injectable()
export class SurveyResponseRepository extends BaseRepository<'survey_responses', SurveyResponse> {
  protected readonly tableName = 'survey_responses' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for survey response query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<SurveyResponse | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findBySurvey(surveyId: Uuid): Promise<SurveyResponse[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('survey_id', '=', surveyId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: SurveyResponse): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): SurveyResponse {
    return new SurveyResponse({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      surveyId: new Uuid(row.survey_id),
      workerId: new Uuid(row.worker_id),
      responses: (row.responses as Record<string, unknown>) ?? {},
      submittedAt: row.submitted_at ?? undefined,
      isAnonymous: row.is_anonymous ?? false,
      status: (row.status as SurveyResponseStatus) ?? 'STARTED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: SurveyResponse): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      survey_id: entity.surveyId.value,
      worker_id: entity.workerId.value,
      responses: entity.responses,
      submitted_at: entity.submittedAt ?? null,
      is_anonymous: entity.isAnonymous,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
