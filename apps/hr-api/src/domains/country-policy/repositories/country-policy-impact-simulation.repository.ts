import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { CountryPolicyImpactSimulation } from '../aggregates/country-policy-impact-simulation.aggregate.js';

/**
 * Repository for {@link CountryPolicyImpactSimulation} aggregates.
 *
 * Uses the Kysely `hr_country_policy.impact_simulations` table.
 */
@Injectable()
export class CountryPolicyImpactSimulationRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<CountryPolicyImpactSimulation | undefined> {
    const row = await this.db
      .selectFrom('hr_country_policy.impact_simulations')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByPolicyPackId(policyPackId: Uuid): Promise<CountryPolicyImpactSimulation[]> {
    const rows = await this.db
      .selectFrom('hr_country_policy.impact_simulations')
      .selectAll()
      .where('policy_pack_id', '=', policyPackId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: CountryPolicyImpactSimulation): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_country_policy.impact_simulations')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      policy_pack_id: entity.policyPackId.value,
      impacted_workers: entity.impactedWorkers,
      impacted_payroll_runs: entity.impactedPayrollRuns,
      impacted_tax_assignments: entity.impactedTaxAssignments,
      impacted_leave_balances: entity.impactedLeaveBalances,
      impacted_benefits: entity.impactedBenefits,
      risk_level: entity.riskLevel ?? null,
      results: entity.results,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_country_policy.impact_simulations')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_country_policy.impact_simulations')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): CountryPolicyImpactSimulation {
    return new CountryPolicyImpactSimulation({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      policyPackId: new Uuid(row.policy_pack_id as string),
      impactedWorkers: Array.isArray(row.impacted_workers) ? (row.impacted_workers as string[]) : [],
      impactedPayrollRuns: Array.isArray(row.impacted_payroll_runs) ? (row.impacted_payroll_runs as string[]) : [],
      impactedTaxAssignments: Array.isArray(row.impacted_tax_assignments) ? (row.impacted_tax_assignments as string[]) : [],
      impactedLeaveBalances: Array.isArray(row.impacted_leave_balances) ? (row.impacted_leave_balances as string[]) : [],
      impactedBenefits: Array.isArray(row.impacted_benefits) ? (row.impacted_benefits as string[]) : [],
      riskLevel: (row.risk_level as CountryPolicyImpactSimulation['riskLevel']) ?? undefined,
      results: (row.results as Record<string, unknown>) ?? {},
      status: row.status as CountryPolicyImpactSimulation['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
