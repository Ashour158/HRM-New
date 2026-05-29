import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { CountryPolicyValidationRun } from '../aggregates/country-policy-validation-run.aggregate.js';

/**
 * Repository for {@link CountryPolicyValidationRun} aggregates.
 *
 * Uses the Kysely `hr_country_policy.validation_runs` table.
 */
@Injectable()
export class CountryPolicyValidationRunRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<CountryPolicyValidationRun | undefined> {
    const row = await this.db
      .selectFrom('hr_country_policy.validation_runs')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByPolicyPackId(policyPackId: Uuid): Promise<CountryPolicyValidationRun[]> {
    const rows = await this.db
      .selectFrom('hr_country_policy.validation_runs')
      .selectAll()
      .where('policy_pack_id', '=', policyPackId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: CountryPolicyValidationRun): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_country_policy.validation_runs')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      policy_pack_id: entity.policyPackId.value,
      validation_type: entity.validationType,
      results: entity.results,
      errors: entity.errors,
      started_at: entity.startedAt ?? null,
      completed_at: entity.completedAt ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_country_policy.validation_runs')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_country_policy.validation_runs')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): CountryPolicyValidationRun {
    return new CountryPolicyValidationRun({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      policyPackId: new Uuid(row.policy_pack_id as string),
      validationType: row.validation_type as string,
      results: (row.results as Record<string, unknown>) ?? {},
      errors: (row.errors as Record<string, unknown>) ?? {},
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      status: row.status as CountryPolicyValidationRun['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
