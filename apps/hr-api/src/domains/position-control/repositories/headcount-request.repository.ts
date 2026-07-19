import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { HeadcountRequest } from '../aggregates/headcount-request.aggregate.js';

/**
 * Repository for {@link HeadcountRequest} aggregates.
 *
 * Uses the Kysely `hr_position.headcount_requests` table as the authoritative store.
 */
@Injectable()
export class HeadcountRequestRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Find a headcount request by its unique identifier.
   */
  async findById(id: Uuid): Promise<HeadcountRequest | undefined> {
    const row = await this.db
      .selectFrom('hr_position.headcount_requests')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find a headcount request by its human-readable request number.
   */
  async findByRequestNumber(requestNumber: string): Promise<HeadcountRequest | undefined> {
    const row = await this.db
      .selectFrom('hr_position.headcount_requests')
      .selectAll()
      .where('request_number', '=', requestNumber)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find all headcount requests submitted by a given requester.
   */
  async findByRequester(requestedBy: Uuid): Promise<HeadcountRequest[]> {
    const rows = await this.db
      .selectFrom('hr_position.headcount_requests')
      .selectAll()
      .where('requested_by', '=', requestedBy.value)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Find all headcount requests pending approval for a tenant.
   */
  async findPendingApproval(tenantId: Uuid): Promise<HeadcountRequest[]> {
    const rows = await this.db
      .selectFrom('hr_position.headcount_requests')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('status', 'in', ['SUBMITTED', 'UNDER_REVIEW'])
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Find all headcount requests for a tenant.
   */
  async findAll(tenantId: Uuid): Promise<HeadcountRequest[]> {
    const rows = await this.db
      .selectFrom('hr_position.headcount_requests')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Compute the current total approved headcount for an org unit (department).
   *
   * Sums `positionsApproved` (falling back to `positionsRequested` for legacy
   * rows with no explicit approved count) across every still-active APPROVED
   * request for the department. REJECTED/CANCELLED/DRAFT/SUBMITTED/UNDER_REVIEW
   * requests do not contribute — only requests that already cleared approval
   * count against the budget.
   */
  async sumApprovedPositionsByDepartment(tenantId: Uuid, departmentId: Uuid): Promise<number> {
    const rows = await this.db
      .selectFrom('hr_position.headcount_requests')
      .select(['positions_requested', 'positions_approved'])
      .where('tenant_id', '=', tenantId.value)
      .where('department_id', '=', departmentId.value)
      .where('status', '=', 'APPROVED')
      .execute();

    return rows.reduce((sum, row: any) => sum + (Number(row.positions_approved ?? row.positions_requested) || 0), 0);
  }

  /**
   * Generate the next request number in the sequence HC-{year}-{sequence}.
   */
  async generateRequestNumber(tenantId: Uuid): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.db
      .selectFrom('hr_position.headcount_requests')
      .select((eb) => eb.fn.countAll().as('count'))
      .where('tenant_id', '=', tenantId.value)
      .where('request_number', 'like', `HC-${year}-%`)
      .executeTakeFirst();

    const count = Number(result?.count ?? 0) + 1;
    return `HC-${year}-${String(count).padStart(4, '0')}`;
  }

  /**
   * Persist a HeadcountRequest aggregate (insert or update).
   */
  async save(entity: HeadcountRequest): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_position.headcount_requests')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      request_number: entity.requestNumber,
      department_id: entity.departmentId?.value ?? null,
      legal_entity_id: entity.legalEntityId?.value ?? null,
      justification: entity.justification,
      requested_by: entity.requestedBy.value,
      approved_by: entity.approvedBy?.value ?? null,
      approved_at: entity.approvedAt ?? null,
      status: entity.status,
      positions_requested: entity.positionsRequested,
      positions_approved: entity.positionsApproved ?? null,
      auto_create_position: entity.autoCreatePosition,
      aggregate_version: entity.version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_position.headcount_requests')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_position.headcount_requests')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): HeadcountRequest {
    return HeadcountRequest.restore({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      requestNumber: row.request_number as string,
      departmentId: row.department_id ? new Uuid(row.department_id as string) : undefined,
      legalEntityId: row.legal_entity_id ? new Uuid(row.legal_entity_id as string) : undefined,
      justification: row.justification as string,
      requestedBy: new Uuid(row.requested_by as string),
      approvedBy: row.approved_by ? new Uuid(row.approved_by as string) : undefined,
      approvedAt: row.approved_at ? new Date(row.approved_at as string) : undefined,
      status: (row.status as HeadcountRequest['status']) ?? undefined,
      positionsRequested: row.positions_requested as number,
      positionsApproved: (row.positions_approved as number | null) ?? undefined,
      autoCreatePosition: row.auto_create_position === true,
      aggregateVersion: (row.aggregate_version as number) ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
