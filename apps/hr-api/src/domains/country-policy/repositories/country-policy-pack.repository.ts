import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { CountryPolicyPack } from '../aggregates/country-policy-pack.aggregate.js';

/**
 * Repository for {@link CountryPolicyPack} aggregates.
 *
 * Uses the Kysely `hr_country_policy.policy_packs` table.
 */
@Injectable()
export class CountryPolicyPackRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<CountryPolicyPack | undefined> {
    const row = await this.db
      .selectFrom('hr_country_policy.policy_packs')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByCountryCode(countryCode: string): Promise<CountryPolicyPack[]> {
    const rows = await this.db
      .selectFrom('hr_country_policy.policy_packs')
      .selectAll()
      .where('country_code', '=', countryCode)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async findAll(): Promise<CountryPolicyPack[]> {
    const rows = await this.db
      .selectFrom('hr_country_policy.policy_packs')
      .selectAll()
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async findPublishedByCountryCode(countryCode: string): Promise<CountryPolicyPack | undefined> {
    const row = await this.db
      .selectFrom('hr_country_policy.policy_packs')
      .selectAll()
      .where('country_code', '=', countryCode)
      .where('status', '=', 'PUBLISHED')
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async save(entity: CountryPolicyPack): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_country_policy.policy_packs')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      country_code: entity.countryCode,
      country_pack_version: entity.countryPackVersion,
      effective_from: entity.effectiveFrom,
      effective_until: entity.effectiveUntil ?? null,
      status: entity.status,
      sections: entity.sections,
      required_approvals: JSON.stringify(entity.requiredApprovals ?? []),
      completed_reviews: JSON.stringify(entity.completedReviews ?? []),
      source_evidence: entity.sourceEvidence,
      recalculation_required: entity.recalculationRequired,
      uploaded_by: entity.uploadedBy?.value ?? null,
      uploaded_at: entity.uploadedAt ?? null,
      published_at: entity.publishedAt ?? null,
      published_by: entity.publishedBy?.value ?? null,
      superseded_by: entity.supersededBy?.value ?? null,
      rollback_reason: entity.rollbackReason ?? null,
      rejected_by: entity.rejectedBy?.value ?? null,
      rejected_at: entity.rejectedAt ?? null,
      rejection_reason: entity.rejectionReason ?? null,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_country_policy.policy_packs')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_country_policy.policy_packs')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): CountryPolicyPack {
    return new CountryPolicyPack({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      countryCode: row.country_code as string,
      countryPackVersion: row.country_pack_version as string,
      effectiveFrom: row.effective_from ? new Date(row.effective_from as string) : new Date(),
      effectiveUntil: row.effective_until ? new Date(row.effective_until as string) : undefined,
      status: row.status as CountryPolicyPack['status'],
      sections: (row.sections as Record<string, unknown>) ?? {},
      requiredApprovals: Array.isArray(row.required_approvals) ? (row.required_approvals as string[]) : [],
      completedReviews: Array.isArray(row.completed_reviews) ? (row.completed_reviews as string[]) : [],
      sourceEvidence: (row.source_evidence as Record<string, unknown>) ?? {},
      recalculationRequired: (row.recalculation_required as boolean) ?? false,
      uploadedBy: row.uploaded_by ? new Uuid(row.uploaded_by as string) : undefined,
      uploadedAt: row.uploaded_at ? new Date(row.uploaded_at as string) : undefined,
      publishedAt: row.published_at ? new Date(row.published_at as string) : undefined,
      publishedBy: row.published_by ? new Uuid(row.published_by as string) : undefined,
      supersededBy: row.superseded_by ? new Uuid(row.superseded_by as string) : undefined,
      rollbackReason: (row.rollback_reason as string) ?? undefined,
      rejectedBy: row.rejected_by ? new Uuid(row.rejected_by as string) : undefined,
      rejectedAt: row.rejected_at ? new Date(row.rejected_at as string) : undefined,
      rejectionReason: (row.rejection_reason as string) ?? undefined,
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
