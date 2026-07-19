import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import {
  OffboardingTask,
  type OffboardingTaskCategory,
  type OffboardingTaskOwnerGroup,
  type OffboardingTaskStatus,
} from '../aggregates/offboarding-task.aggregate.js';

/**
 * Repository for {@link OffboardingTask} aggregates.
 *
 * Uses the Kysely `hr_offboarding.offboarding_tasks` table as the authoritative store.
 */
@Injectable()
export class OffboardingTaskRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Find an offboarding task by its unique identifier.
   */
  async findById(id: Uuid): Promise<OffboardingTask | undefined> {
    const row = await this.db
      .selectFrom('hr_offboarding.offboarding_tasks')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find all tasks belonging to an offboarding plan.
   */
  async findByPlan(planId: Uuid): Promise<OffboardingTask[]> {
    const rows = await this.db
      .selectFrom('hr_offboarding.offboarding_tasks')
      .selectAll()
      .where('offboarding_plan_id', '=', planId.value)
      .orderBy('due_date', 'asc')
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Find all tasks for a tenant.
   */
  async findByTenant(tenantId: Uuid): Promise<OffboardingTask[]> {
    const rows = await this.db
      .selectFrom('hr_offboarding.offboarding_tasks')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('due_date', 'asc')
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Find all tasks assigned to a given worker (owner or the departing employee).
   */
  async findByAssignee(assigneeId: Uuid): Promise<OffboardingTask[]> {
    const rows = await this.db
      .selectFrom('hr_offboarding.offboarding_tasks')
      .selectAll()
      .where('assigned_to', '=', assigneeId.value)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Find all overdue tasks (due date passed and not completed).
   */
  async findOverdue(): Promise<OffboardingTask[]> {
    const now = new Date();
    const rows = await this.db
      .selectFrom('hr_offboarding.offboarding_tasks')
      .selectAll()
      .where('due_date', '<', now)
      .where('status', 'not in', ['COMPLETED', 'SKIPPED'])
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Persist an OffboardingTask aggregate (insert or update).
   */
  async save(entity: OffboardingTask): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_offboarding.offboarding_tasks')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      offboarding_plan_id: entity.offboardingPlanId.value,
      title: entity.title,
      description: entity.description ?? null,
      assigned_to: entity.assignedTo?.value ?? null,
      owner_group: entity.ownerGroup,
      category: entity.category,
      required: entity.required,
      evidence_type: entity.evidenceType ?? null,
      evidence_payload: entity.evidencePayload ?? null,
      completion_notes: entity.completionNotes ?? null,
      due_date: entity.dueDate ? entity.dueDate.toISOString() : null,
      completed_at: entity.completedAt ? entity.completedAt.toISOString() : null,
      status: entity.status,
      aggregate_version: entity.version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_offboarding.offboarding_tasks')
        .set(row as never)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_offboarding.offboarding_tasks')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): OffboardingTask {
    return OffboardingTask.restore({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      offboardingPlanId: new Uuid(row.offboarding_plan_id as string),
      title: row.title as string,
      description: (row.description as string) ?? undefined,
      assignedTo: row.assigned_to ? new Uuid(row.assigned_to as string) : undefined,
      ownerGroup: (row.owner_group as OffboardingTaskOwnerGroup) ?? undefined,
      category: (row.category as OffboardingTaskCategory) ?? undefined,
      required: (row.required as boolean) ?? undefined,
      evidenceType: (row.evidence_type as string) ?? undefined,
      evidencePayload: (row.evidence_payload as Record<string, unknown>) ?? undefined,
      completionNotes: (row.completion_notes as string) ?? undefined,
      dueDate: row.due_date ? new Date(row.due_date as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      status: (row.status as OffboardingTaskStatus) ?? undefined,
      aggregateVersion: (row.aggregate_version as number) ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
