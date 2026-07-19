import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import {
  OffboardingPlan,
  type OffboardingPlanStatus,
  type OffboardingReasonCategory,
} from '../aggregates/offboarding-plan.aggregate.js';

/**
 * Repository for {@link OffboardingPlan} aggregates.
 *
 * Uses the Kysely `hr_offboarding.offboarding_plans` table as the authoritative store.
 */
@Injectable()
export class OffboardingPlanRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Find an offboarding plan by its unique identifier.
   */
  async findById(id: Uuid): Promise<OffboardingPlan | undefined> {
    const row = await this.db
      .selectFrom('hr_offboarding.offboarding_plans')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find the offboarding plan for a given worker. A worker may have more
   * than one plan across their tenure (e.g. rehire); the most recently
   * created plan is returned.
   */
  async findByWorker(workerId: Uuid): Promise<OffboardingPlan | undefined> {
    const row = await this.db
      .selectFrom('hr_offboarding.offboarding_plans')
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find all offboarding plans with a given status.
   */
  async findByStatus(status: OffboardingPlanStatus): Promise<OffboardingPlan[]> {
    const rows = await this.db
      .selectFrom('hr_offboarding.offboarding_plans')
      .selectAll()
      .where('status', '=', status)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Find all offboarding plans for a tenant.
   */
  async findByTenant(tenantId: Uuid): Promise<OffboardingPlan[]> {
    const rows = await this.db
      .selectFrom('hr_offboarding.offboarding_plans')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('last_working_day', 'desc')
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Persist an OffboardingPlan aggregate (insert or update).
   */
  async save(entity: OffboardingPlan): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_offboarding.offboarding_plans')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      last_working_day: entity.lastWorkingDay.toISOString(),
      initiated_by: entity.initiatedBy.value,
      reason_category: entity.reasonCategory,
      reason_notes: entity.reasonNotes ?? null,
      manager_id: entity.managerId?.value ?? null,
      status: entity.status,
      aggregate_version: entity.version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_offboarding.offboarding_plans')
        .set(row as never)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_offboarding.offboarding_plans')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): OffboardingPlan {
    return OffboardingPlan.restore({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      workerId: new Uuid(row.worker_id as string),
      lastWorkingDay: new Date(row.last_working_day as string),
      initiatedBy: new Uuid(row.initiated_by as string),
      reasonCategory: (row.reason_category as OffboardingReasonCategory) ?? undefined,
      reasonNotes: (row.reason_notes as string) ?? undefined,
      managerId: row.manager_id ? new Uuid(row.manager_id as string) : undefined,
      status: (row.status as OffboardingPlanStatus) ?? undefined,
      aggregateVersion: (row.aggregate_version as number) ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
