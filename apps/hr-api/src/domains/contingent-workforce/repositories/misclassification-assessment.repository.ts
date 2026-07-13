import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { MisclassificationAssessment, type MisclassificationAssessmentStatus } from '../aggregates/misclassification-assessment.aggregate.js';
import type { MisclassificationFactorInputs } from '../services/misclassification-scoring.js';

function stringArrayFromJsonb(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function factorInputsFromJsonb(value: unknown): MisclassificationFactorInputs | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as MisclassificationFactorInputs;
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      return JSON.parse(value) as MisclassificationFactorInputs;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

@Injectable()
export class MisclassificationAssessmentRepository extends BaseRepository<'misclassification_assessments', MisclassificationAssessment> {
  protected readonly tableName = 'misclassification_assessments' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<MisclassificationAssessment | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['misclassification_assessments']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<MisclassificationAssessment[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['misclassification_assessments']));
  }



  async save(entity: MisclassificationAssessment): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['misclassification_assessments']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['misclassification_assessments']>);
    }
  }

  private toAggregate(row: Database['misclassification_assessments']): MisclassificationAssessment {
    return new MisclassificationAssessment({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      assessmentDate: row.assessment_date,
      factorInputs: factorInputsFromJsonb((row as unknown as { factor_inputs?: unknown }).factor_inputs),
      riskScore: row.risk_score ?? undefined,
      riskFactors: stringArrayFromJsonb(row.risk_factors),
      status: row.status as MisclassificationAssessmentStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: MisclassificationAssessment): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      assessment_date: entity.assessmentDate,
      factor_inputs: entity.factorInputs ? JSON.stringify(entity.factorInputs) : null,
      risk_score: entity.riskScore ?? null,
      risk_factors: JSON.stringify(entity.riskFactors ?? []),
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
