import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { HeadcountBudget } from '../aggregates/headcount-budget.aggregate.js';

/**
 * Repository for {@link HeadcountBudget} aggregates.
 *
 * Uses the Kysely `hr_position.headcount_budgets` table as the authoritative store.
 */
@Injectable()
export class HeadcountBudgetRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Find a headcount budget by its unique identifier.
   */
  async findById(id: Uuid): Promise<HeadcountBudget | undefined> {
    const row = await this.db
      .selectFrom('hr_position.headcount_budgets')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find the configured budget for a given org unit (department) and fiscal year.
   *
   * There is at most one budget per (tenantId, departmentId, fiscalYear) tuple.
   */
  async findByDepartmentAndYear(
    tenantId: Uuid,
    departmentId: Uuid,
    fiscalYear: number,
  ): Promise<HeadcountBudget | undefined> {
    const row = await this.db
      .selectFrom('hr_position.headcount_budgets')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('department_id', '=', departmentId.value)
      .where('fiscal_year', '=', fiscalYear)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find all headcount budgets configured for a tenant, optionally scoped to a fiscal year.
   */
  async findAll(tenantId: Uuid, fiscalYear?: number): Promise<HeadcountBudget[]> {
    let query = this.db
      .selectFrom('hr_position.headcount_budgets')
      .selectAll()
      .where('tenant_id', '=', tenantId.value);

    if (fiscalYear !== undefined) {
      query = query.where('fiscal_year', '=', fiscalYear);
    }

    const rows = await query.execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Persist a HeadcountBudget aggregate (insert or update).
   */
  async save(entity: HeadcountBudget): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_position.headcount_budgets')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      department_id: entity.departmentId.value,
      fiscal_year: entity.fiscalYear,
      ceiling: entity.ceiling,
      set_by: entity.setBy.value,
      aggregate_version: entity.version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_position.headcount_budgets')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_position.headcount_budgets')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): HeadcountBudget {
    return HeadcountBudget.restore({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      departmentId: new Uuid(row.department_id as string),
      fiscalYear: row.fiscal_year as number,
      ceiling: row.ceiling as number,
      setBy: new Uuid(row.set_by as string),
      aggregateVersion: (row.aggregate_version as number) ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
