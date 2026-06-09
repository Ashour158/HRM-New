import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { InterviewPlan, type InterviewPlanStatus, type InterviewFormat } from '../aggregates/interview-plan.aggregate.js';

/**
 * Repository for {@link InterviewPlan} aggregates.
 *
 * Uses the Kysely `hr_recruiting.interview_plans` table as the authoritative store.
 */
@Injectable()
export class InterviewPlanRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Find an interview plan by its unique identifier.
   */
  async findById(id: Uuid): Promise<InterviewPlan | undefined> {
    const row = await this.db
      .selectFrom('hr_recruiting.interview_plans')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find all interview plans for a given candidate.
   */
  async findByCandidate(candidateId: Uuid): Promise<InterviewPlan[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.interview_plans')
      .selectAll()
      .where('candidate_id', '=', candidateId.value)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Find all interview plans for a given requisition.
   */
  async findByRequisition(requisitionId: Uuid): Promise<InterviewPlan[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.interview_plans')
      .selectAll()
      .where('requisition_id', '=', requisitionId.value)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Persist an InterviewPlan aggregate (insert or update).
   */
  async save(entity: InterviewPlan): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_recruiting.interview_plans')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      candidate_id: entity.candidateId.value,
      requisition_id: entity.requisitionId.value,
      interviewers: entity.interviewers.map((i) => i.value) as unknown as string[],
      scheduled_at: entity.scheduledAt ? entity.scheduledAt.toISOString() : null,
      format: entity.format ?? null,
      status: entity.status,
      aggregate_version: entity.version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_recruiting.interview_plans')
        .set(row as never)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_recruiting.interview_plans')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): InterviewPlan {
    return InterviewPlan.create(
      {
        id: new Uuid(row.id as string),
        tenantId: new Uuid(row.tenant_id as string),
        candidateId: new Uuid(row.candidate_id as string),
        requisitionId: new Uuid(row.requisition_id as string),
        interviewers: Array.isArray(row.interviewers)
          ? (row.interviewers as string[]).map((id) => new Uuid(id))
          : [],
        scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as string) : undefined,
        format: (row.format as InterviewFormat) ?? undefined,
        status: (row.status as InterviewPlanStatus) ?? undefined,
        aggregateVersion: (row.aggregate_version as number) ?? undefined,
        createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
      },
      Uuid.generate(),
    );
  }
}
