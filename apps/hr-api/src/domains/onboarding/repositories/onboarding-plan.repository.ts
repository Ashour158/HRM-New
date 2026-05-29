import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { OnboardingPlan, type OnboardingPlanStatus } from '../aggregates/onboarding-plan.aggregate.js';

/**
 * Repository for {@link OnboardingPlan} aggregates.
 *
 * Uses the Kysely `hr_onboarding.onboarding_plans` table as the authoritative store.
 */
@Injectable()
export class OnboardingPlanRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Find an onboarding plan by its unique identifier.
   */
  async findById(id: Uuid): Promise<OnboardingPlan | undefined> {
    const row = await this.db
      .selectFrom('hr_onboarding.onboarding_plans')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find the onboarding plan for a given worker.
   */
  async findByWorker(workerId: Uuid): Promise<OnboardingPlan | undefined> {
    const row = await this.db
      .selectFrom('hr_onboarding.onboarding_plans')
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find all onboarding plans with a given status.
   */
  async findByStatus(status: OnboardingPlanStatus): Promise<OnboardingPlan[]> {
    const rows = await this.db
      .selectFrom('hr_onboarding.onboarding_plans')
      .selectAll()
      .where('status', '=', status)
      .execute();

    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Persist an OnboardingPlan aggregate (insert or update).
   */
  async save(entity: OnboardingPlan): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_onboarding.onboarding_plans')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      start_date: entity.startDate.toISOString(),
      assigned_buddy_id: entity.assignedBuddyId?.value ?? null,
      status: entity.status,
      aggregate_version: entity.version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_onboarding.onboarding_plans')
        .set(row as never)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_onboarding.onboarding_plans')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): OnboardingPlan {
    return OnboardingPlan.create(
      {
        id: new Uuid(row.id as string),
        tenantId: new Uuid(row.tenant_id as string),
        workerId: new Uuid(row.worker_id as string),
        startDate: new Date(row.start_date as string),
        assignedBuddyId: row.assigned_buddy_id ? new Uuid(row.assigned_buddy_id as string) : undefined,
        status: (row.status as OnboardingPlanStatus) ?? undefined,
        aggregateVersion: (row.aggregate_version as number) ?? undefined,
        createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
      },
      Uuid.generate(),
    );
  }
}
