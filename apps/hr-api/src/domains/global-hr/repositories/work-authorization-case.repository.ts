import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { WorkAuthorizationCase } from '../aggregates/work-authorization-case.aggregate.js';

/**
 * Repository for {@link WorkAuthorizationCase} aggregates.
 *
 * Uses the Kysely `hr_global_hr.work_authorization_cases` table.
 */
@Injectable()
export class WorkAuthorizationCaseRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<WorkAuthorizationCase | undefined> {
    const row = await this.db
      .selectFrom('hr_global_hr.work_authorization_cases')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<WorkAuthorizationCase[]> {
    const rows = await this.db
      .selectFrom('hr_global_hr.work_authorization_cases')
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async findActiveByWorker(workerId: Uuid): Promise<WorkAuthorizationCase | undefined> {
    const row = await this.db
      .selectFrom('hr_global_hr.work_authorization_cases')
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .where('status', 'in', ['OPEN', 'UNDER_REVIEW', 'APPROVED', 'RENEWED'])
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async save(entity: WorkAuthorizationCase): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_global_hr.work_authorization_cases')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      authorization_type: entity.authorizationType,
      issuing_country: entity.issuingCountry,
      document_number: entity.documentNumber ?? null,
      valid_from: entity.validFrom ?? null,
      valid_until: entity.validUntil ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_global_hr.work_authorization_cases')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_global_hr.work_authorization_cases')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): WorkAuthorizationCase {
    return new WorkAuthorizationCase({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      workerId: new Uuid(row.worker_id as string),
      authorizationType: row.authorization_type as string,
      issuingCountry: row.issuing_country as string,
      documentNumber: (row.document_number as string) ?? undefined,
      validFrom: row.valid_from ? new Date(row.valid_from as string) : undefined,
      validUntil: row.valid_until ? new Date(row.valid_until as string) : undefined,
      status: row.status as WorkAuthorizationCase['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
