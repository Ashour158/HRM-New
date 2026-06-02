import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import {
  OnboardingTask,
  type OnboardingTaskCategory,
  type OnboardingTaskOwnerGroup,
  type OnboardingTaskStatus,
} from '../aggregates/onboarding-task.aggregate.js';

/**
 * Repository for {@link OnboardingTask} aggregates.
 *
 * Uses the Kysely `hr_onboarding.onboarding_tasks` table as the authoritative store.
 */
@Injectable()
export class OnboardingTaskRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Find an onboarding task by its unique identifier.
   */
  async findById(id: Uuid): Promise<OnboardingTask | undefined> {
    const row = await this.db
      .selectFrom('hr_onboarding.onboarding_tasks')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find all tasks belonging to an onboarding plan.
   */
  async findByPlan(planId: Uuid): Promise<OnboardingTask[]> {
    const rows = await this.db
      .selectFrom('hr_onboarding.onboarding_tasks')
      .selectAll()
      .where('onboarding_plan_id', '=', planId.value)
      .orderBy('due_date', 'asc')
      .execute();

    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Find all tasks for a tenant.
   */
  async findByTenant(tenantId: Uuid): Promise<OnboardingTask[]> {
    const rows = await this.db
      .selectFrom('hr_onboarding.onboarding_tasks')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('due_date', 'asc')
      .execute();

    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Find all tasks assigned to a given worker.
   */
  async findByAssignee(assigneeId: Uuid): Promise<OnboardingTask[]> {
    const rows = await this.db
      .selectFrom('hr_onboarding.onboarding_tasks')
      .selectAll()
      .where('assigned_to', '=', assigneeId.value)
      .execute();

    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Find all overdue tasks (due date passed and not completed).
   */
  async findOverdue(): Promise<OnboardingTask[]> {
    const now = new Date();
    const rows = await this.db
      .selectFrom('hr_onboarding.onboarding_tasks')
      .selectAll()
      .where('due_date', '<', now)
      .where('status', 'not in', ['COMPLETED', 'SKIPPED'])
      .execute();

    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Persist an OnboardingTask aggregate (insert or update).
   */
  async save(entity: OnboardingTask): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_onboarding.onboarding_tasks')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      onboarding_plan_id: entity.onboardingPlanId.value,
      title: entity.title,
      description: entity.description ?? null,
      assigned_to: entity.assignedTo?.value ?? null,
      owner_group: entity.ownerGroup,
      category: entity.category,
      required: entity.required,
      evidence_type: entity.evidenceType ?? null,
      evidence_payload: entity.evidencePayload ?? null,
      provisioning_target: entity.provisioningTarget ?? null,
      signing_provider_envelope_id: entity.signingProviderEnvelopeId ?? null,
      milestone_day: entity.milestoneDay ?? null,
      completion_notes: entity.completionNotes ?? null,
      due_date: entity.dueDate ? entity.dueDate.toISOString() : null,
      completed_at: entity.completedAt ? entity.completedAt.toISOString() : null,
      status: entity.status,
      aggregate_version: entity.version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_onboarding.onboarding_tasks')
        .set(row as never)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_onboarding.onboarding_tasks')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): OnboardingTask {
    return OnboardingTask.restore(
      {
        id: new Uuid(row.id as string),
        tenantId: new Uuid(row.tenant_id as string),
        onboardingPlanId: new Uuid(row.onboarding_plan_id as string),
        title: row.title as string,
        description: (row.description as string) ?? undefined,
        assignedTo: row.assigned_to ? new Uuid(row.assigned_to as string) : undefined,
        ownerGroup: (row.owner_group as OnboardingTaskOwnerGroup) ?? undefined,
        category: (row.category as OnboardingTaskCategory) ?? undefined,
        required: (row.required as boolean) ?? undefined,
        evidenceType: (row.evidence_type as string) ?? undefined,
        evidencePayload: (row.evidence_payload as Record<string, unknown>) ?? undefined,
        provisioningTarget: (row.provisioning_target as string) ?? undefined,
        signingProviderEnvelopeId: (row.signing_provider_envelope_id as string) ?? undefined,
        milestoneDay: (row.milestone_day as number) ?? undefined,
        completionNotes: (row.completion_notes as string) ?? undefined,
        dueDate: row.due_date ? new Date(row.due_date as string) : undefined,
        completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
        status: (row.status as OnboardingTaskStatus) ?? undefined,
        aggregateVersion: (row.aggregate_version as number) ?? undefined,
        createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
      },
    );
  }
}
