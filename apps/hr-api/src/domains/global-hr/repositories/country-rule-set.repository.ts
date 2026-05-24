import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { CountryRuleSet } from '../aggregates/country-rule-set.aggregate.js';

/**
 * Repository for {@link CountryRuleSet} aggregates.
 *
 * Uses the Kysely `hr_global_hr.country_rule_sets` table.
 */
@Injectable()
export class CountryRuleSetRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<CountryRuleSet | undefined> {
    const row = await this.db
      .selectFrom('hr_global_hr.country_rule_sets')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByCountryCode(countryCode: string): Promise<CountryRuleSet[]> {
    const rows = await this.db
      .selectFrom('hr_global_hr.country_rule_sets')
      .selectAll()
      .where('country_code', '=', countryCode)
      .execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async findActiveByCountryCode(countryCode: string): Promise<CountryRuleSet | undefined> {
    const row = await this.db
      .selectFrom('hr_global_hr.country_rule_sets')
      .selectAll()
      .where('country_code', '=', countryCode)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async save(entity: CountryRuleSet): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_global_hr.country_rule_sets')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      country_code: entity.countryCode,
      rule_set_type: entity.ruleSetType,
      version: entity.ruleSetVersion,
      effective_from: entity.effectiveFrom,
      effective_until: entity.effectiveUntil ?? null,
      rules: entity.rules,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_global_hr.country_rule_sets')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_global_hr.country_rule_sets')
        .values({ ...row, created_at: new Date().toISOString() } as any)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): CountryRuleSet {
    return new CountryRuleSet({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      countryCode: row.country_code as string,
      ruleSetType: row.rule_set_type as string,
      ruleSetVersion: row.version as string,
      effectiveFrom: row.effective_from ? new Date(row.effective_from as string) : new Date(),
      effectiveUntil: row.effective_until ? new Date(row.effective_until as string) : undefined,
      rules: (row.rules as Record<string, unknown>) ?? {},
      status: row.status as CountryRuleSet['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
