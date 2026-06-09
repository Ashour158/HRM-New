import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { JobRequisition, type JobRequisitionStatus } from '../aggregates/job-requisition.aggregate.js';

/**
 * Repository for {@link JobRequisition} aggregates.
 *
 * Uses the Kysely `hr_recruiting.job_requisitions` table as the authoritative store.
 */
@Injectable()
export class JobRequisitionRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Find a requisition by its unique identifier.
   */
  async findById(id: Uuid): Promise<JobRequisition | undefined> {
    const row = await this.db
      .selectFrom('hr_recruiting.job_requisitions')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find a requisition by its requisition number.
   */
  async findByRequisitionNumber(number: string): Promise<JobRequisition | undefined> {
    const row = await this.db
      .selectFrom('hr_recruiting.job_requisitions')
      .selectAll()
      .where('requisition_number', '=', number)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find all requisitions for a given position.
   */
  async findByPosition(positionId: Uuid): Promise<JobRequisition[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.job_requisitions')
      .selectAll()
      .where('position_id', '=', positionId.value)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Find all requisitions for a given department.
   */
  async findByDepartment(departmentId: Uuid): Promise<JobRequisition[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.job_requisitions')
      .selectAll()
      .where('department_id', '=', departmentId.value)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Find all open requisitions for a tenant.
   */
  async findOpen(tenantId: Uuid): Promise<JobRequisition[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.job_requisitions')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('status', '=', 'OPEN')
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Persist a JobRequisition aggregate (insert or update).
   */
  async save(entity: JobRequisition): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_recruiting.job_requisitions')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      requisition_number: entity.requisitionNumber,
      position_id: entity.positionId.value,
      department_id: entity.departmentId?.value ?? null,
      hiring_manager_id: entity.hiringManagerId?.value ?? null,
      recruiter_id: entity.recruiterId?.value ?? null,
      title: entity.title,
      description: entity.description ?? null,
      status: entity.status,
      published_at: entity.publishedAt ? entity.publishedAt.toISOString() : null,
      filled_at: entity.filledAt ? entity.filledAt.toISOString() : null,
      closed_at: entity.closedAt ? entity.closedAt.toISOString() : null,
      aggregate_version: entity.version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_recruiting.job_requisitions')
        .set(row as never)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_recruiting.job_requisitions')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): JobRequisition {
    return JobRequisition.create(
      {
        id: new Uuid(row.id as string),
        tenantId: new Uuid(row.tenant_id as string),
        requisitionNumber: row.requisition_number as string,
        positionId: new Uuid(row.position_id as string),
        departmentId: row.department_id ? new Uuid(row.department_id as string) : undefined,
        hiringManagerId: row.hiring_manager_id ? new Uuid(row.hiring_manager_id as string) : undefined,
        recruiterId: row.recruiter_id ? new Uuid(row.recruiter_id as string) : undefined,
        title: row.title as string,
        description: (row.description as string) ?? undefined,
        status: (row.status as JobRequisitionStatus) ?? undefined,
        publishedAt: row.published_at ? new Date(row.published_at as string) : undefined,
        filledAt: row.filled_at ? new Date(row.filled_at as string) : undefined,
        closedAt: row.closed_at ? new Date(row.closed_at as string) : undefined,
        aggregateVersion: (row.aggregate_version as number) ?? undefined,
        createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
      },
      Uuid.generate(),
    );
  }
}
