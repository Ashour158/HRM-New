import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { EeoDemographicDimension } from '@hcm/policy-engines';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { RequisitionAdverseImpactAnalysis, type RequisitionAdverseImpactAnalysisStatus } from '../aggregates/requisition-adverse-impact-analysis.aggregate.js';

/**
 * Repository for {@link RequisitionAdverseImpactAnalysis} aggregates.
 *
 * Uses the Kysely `hr_recruiting.requisition_adverse_impact_analyses` table
 * as the authoritative store. `stage_results` is always the already
 * k-anonymity-suppressed, group-level payload produced by the aggregate —
 * this repository never touches individual candidate records.
 */
@Injectable()
export class RequisitionAdverseImpactAnalysisRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * @deprecated Not tenant-scoped — reachable by any authenticated actor
   * regardless of tenant. Use {@link findByIdForTenant} for any lookup
   * driven by a caller-supplied id (route params, command payloads). This
   * analysis surfaces group-level EEOC-protected-class outcome data, so
   * cross-tenant reachability here is a PII/compliance exposure.
   */
  async findById(id: Uuid): Promise<RequisitionAdverseImpactAnalysis | undefined> {
    const row = await this.db
      .selectFrom('hr_recruiting.requisition_adverse_impact_analyses')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Tenant-scoped lookup by id. Controllers/handlers that resolve an
   * adverse-impact analysis from a caller-supplied id (route param or
   * command payload) MUST use this instead of {@link findById} so that a
   * caller from tenant A cannot read tenant B's EEOC-protected-class outcome
   * data by guessing or enumerating its id.
   */
  async findByIdForTenant(id: Uuid, tenantId: Uuid): Promise<RequisitionAdverseImpactAnalysis | undefined> {
    const row = await this.db
      .selectFrom('hr_recruiting.requisition_adverse_impact_analyses')
      .selectAll()
      .where('id', '=', id.value)
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * @deprecated Not tenant-scoped. Use {@link findByRequisitionForTenant}.
   */
  async findByRequisition(requisitionId: Uuid): Promise<RequisitionAdverseImpactAnalysis[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.requisition_adverse_impact_analyses')
      .selectAll()
      .where('requisition_id', '=', requisitionId.value)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Tenant-scoped lookup of all adverse-impact analyses for a given
   * requisition.
   */
  async findByRequisitionForTenant(requisitionId: Uuid, tenantId: Uuid): Promise<RequisitionAdverseImpactAnalysis[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.requisition_adverse_impact_analyses')
      .selectAll()
      .where('requisition_id', '=', requisitionId.value)
      .where('tenant_id', '=', tenantId.value)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: RequisitionAdverseImpactAnalysis): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_recruiting.requisition_adverse_impact_analyses')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      requisition_id: entity.requisitionId.value,
      dimension: entity.dimension,
      decision_code: entity.decisionCode,
      flagged_stage_count: entity.flaggedStageCount,
      small_cell_threshold: entity.smallCellThreshold,
      stage_results: entity.stageResults,
      status: entity.status,
      reviewed_by: entity.reviewedBy?.value ?? null,
      reviewed_at: entity.reviewedAt ? entity.reviewedAt.toISOString() : null,
      review_notes: entity.reviewNotes ?? null,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_recruiting.requisition_adverse_impact_analyses')
        .set(row as never)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_recruiting.requisition_adverse_impact_analyses')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): RequisitionAdverseImpactAnalysis {
    return new RequisitionAdverseImpactAnalysis({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      requisitionId: new Uuid(row.requisition_id as string),
      dimension: row.dimension as EeoDemographicDimension,
      decisionCode: row.decision_code as string,
      flaggedStageCount: row.flagged_stage_count as number,
      smallCellThreshold: row.small_cell_threshold as number,
      stageResults: (row.stage_results as Record<string, unknown>) ?? {},
      status: row.status as RequisitionAdverseImpactAnalysisStatus,
      reviewedBy: row.reviewed_by ? new Uuid(row.reviewed_by as string) : undefined,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : undefined,
      reviewNotes: (row.review_notes as string) ?? undefined,
      aggregateVersion: (row.aggregate_version as number) ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
