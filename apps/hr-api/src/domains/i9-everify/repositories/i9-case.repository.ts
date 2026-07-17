import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { I9Case } from '../aggregates/i9-case.aggregate.js';

/**
 * Repository for {@link I9Case} aggregates.
 *
 * Uses the Kysely `hr_i9_everify.i9_forms` table.
 */
@Injectable()
export class I9CaseRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<I9Case | undefined> {
    const row = await this.db
      .selectFrom('hr_i9_everify.i9_forms')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<I9Case[]> {
    const rows = await this.db
      .selectFrom('hr_i9_everify.i9_forms')
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async findByTenant(tenantId: Uuid): Promise<I9Case[]> {
    const rows = await this.db
      .selectFrom('hr_i9_everify.i9_forms')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: I9Case): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_i9_everify.i9_forms')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      start_date: entity.startDate,
      status: entity.status,
      citizenship_status: entity.citizenshipStatus ?? null,
      section1_completed_at: entity.section1CompletedAt ?? null,
      section1_late: entity.section1LateFlag,
      document_type: entity.documentType ?? null,
      document_descriptions: JSON.stringify(entity.documentDescriptions ?? []),
      document_expiration_date: entity.documentExpirationDate ?? null,
      reviewer_id: entity.reviewerId?.value ?? null,
      section2_due_date: entity.section2DueDate,
      section2_completed_at: entity.section2CompletedAt ?? null,
      section2_late: entity.section2LateFlag,
      everify_case_id: entity.everifyCaseId?.value ?? null,
      rejection_reason: entity.rejectionReason ?? null,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_i9_everify.i9_forms')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_i9_everify.i9_forms')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): I9Case {
    const documentDescriptions = row.document_descriptions
      ? (typeof row.document_descriptions === 'string' ? JSON.parse(row.document_descriptions) : row.document_descriptions)
      : [];
    return new I9Case({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      workerId: new Uuid(row.worker_id as string),
      startDate: new Date(row.start_date as string),
      status: row.status as I9Case['status'],
      citizenshipStatus: (row.citizenship_status as I9Case['citizenshipStatus']) ?? undefined,
      section1CompletedAt: row.section1_completed_at ? new Date(row.section1_completed_at as string) : undefined,
      section1LateFlag: Boolean(row.section1_late),
      documentType: (row.document_type as I9Case['documentType']) ?? undefined,
      documentDescriptions: documentDescriptions as string[],
      documentExpirationDate: row.document_expiration_date ? new Date(row.document_expiration_date as string) : undefined,
      reviewerId: row.reviewer_id ? new Uuid(row.reviewer_id as string) : undefined,
      section2DueDate: new Date(row.section2_due_date as string),
      section2CompletedAt: row.section2_completed_at ? new Date(row.section2_completed_at as string) : undefined,
      section2LateFlag: Boolean(row.section2_late),
      everifyCaseId: row.everify_case_id ? new Uuid(row.everify_case_id as string) : undefined,
      rejectionReason: (row.rejection_reason as string) ?? undefined,
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
