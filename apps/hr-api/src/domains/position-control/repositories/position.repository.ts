import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { Position } from '../aggregates/position.aggregate.js';

/**
 * Repository for {@link Position} aggregates.
 *
 * Uses the Kysely `hr_position.positions` table as the authoritative store.
 */
@Injectable()
export class PositionRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Find a position by its unique identifier.
   */
  async findById(id: Uuid): Promise<Position | undefined> {
    const row = await this.db
      .selectFrom('hr_position.positions')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find a position by its unique code (scoped to tenant).
   */
  async findByCode(code: string): Promise<Position | undefined> {
    const row = await this.db
      .selectFrom('hr_position.positions')
      .selectAll()
      .where('position_code', '=', code)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find all positions belonging to a department.
   */
  async findByDepartment(departmentId: Uuid): Promise<Position[]> {
    const rows = await this.db
      .selectFrom('hr_position.positions')
      .selectAll()
      .where('department_id', '=', departmentId.value)
      .execute();

    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Find all positions belonging to a legal entity.
   */
  async findByLegalEntity(legalEntityId: Uuid): Promise<Position[]> {
    const rows = await this.db
      .selectFrom('hr_position.positions')
      .selectAll()
      .where('legal_entity_id', '=', legalEntityId.value)
      .execute();

    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Find all vacant positions for a tenant.
   */
  async findVacant(tenantId: Uuid): Promise<Position[]> {
    const rows = await this.db
      .selectFrom('hr_position.positions')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('status', '=', 'VACANT')
      .execute();

    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Find all active positions for a tenant.
   */
  async findActive(tenantId: Uuid): Promise<Position[]> {
    const rows = await this.db
      .selectFrom('hr_position.positions')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('status', '=', 'ACTIVE')
      .execute();

    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Find all positions for a tenant with optional status filter.
   */
  async findAll(tenantId: Uuid, status?: string): Promise<Position[]> {
    let query = this.db
      .selectFrom('hr_position.positions')
      .selectAll()
      .where('tenant_id', '=', tenantId.value);

    if (status) {
      query = query.where('status', '=', status);
    }

    const rows = await query.execute();
    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Find a position filled by a specific worker.
   */
  async findByFilledWorkerId(workerId: Uuid): Promise<Position | undefined> {
    const row = await this.db
      .selectFrom('hr_position.positions')
      .selectAll()
      .where('filled_by_worker_id', '=', workerId.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Persist a Position aggregate (insert or update).
   */
  async save(entity: Position): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_position.positions')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      position_code: entity.positionCode,
      title: entity.title,
      department_id: entity.departmentId?.value ?? null,
      legal_entity_id: entity.legalEntityId?.value ?? null,
      job_family: entity.jobFamily ?? null,
      job_level: entity.jobLevel ?? null,
      employment_type: entity.employmentType,
      status: entity.status,
      filled_by_worker_id: entity.filledByWorkerId?.value ?? null,
      headcount_request_id: entity.headcountRequestId?.value ?? null,
      aggregate_version: entity.version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_position.positions')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_position.positions')
        .values({ ...row, created_at: new Date().toISOString() } as any)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): Position {
    return Position.create({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      positionCode: row.position_code as string,
      title: row.title as string,
      departmentId: row.department_id ? new Uuid(row.department_id as string) : undefined,
      legalEntityId: row.legal_entity_id ? new Uuid(row.legal_entity_id as string) : undefined,
      jobFamily: (row.job_family as string) ?? undefined,
      jobLevel: (row.job_level as string) ?? undefined,
      employmentType: row.employment_type as string,
      status: (row.status as Position['status']) ?? undefined,
      filledByWorkerId: row.filled_by_worker_id ? new Uuid(row.filled_by_worker_id as string) : undefined,
      headcountRequestId: row.headcount_request_id ? new Uuid(row.headcount_request_id as string) : undefined,
      aggregateVersion: (row.aggregate_version as number) ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
