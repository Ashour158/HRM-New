import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { PolicyDocument } from '../aggregates/policy-document.aggregate.js';

/**
 * Repository for {@link PolicyDocument} aggregates.
 *
 * Uses the Kysely `hr_compliance.policy_documents` table as the authoritative store.
 * Ensures tenant isolation via the tenant plugin.
 */
@Injectable()
export class PolicyDocumentRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<PolicyDocument | undefined> {
    const row = await this.db
      .selectFrom('hr_compliance.policy_documents')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByTitle(title: string): Promise<PolicyDocument | undefined> {
    const row = await this.db
      .selectFrom('hr_compliance.policy_documents')
      .selectAll()
      .where('title', '=', title)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByStatus(status: string): Promise<PolicyDocument[]> {
    const rows = await this.db
      .selectFrom('hr_compliance.policy_documents')
      .selectAll()
      .where('status', '=', status)
      .execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: PolicyDocument): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_compliance.policy_documents')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      title: entity.title,
      document_type: entity.documentType,
      document_version: entity.documentVersion,
      content: entity.content,
      effective_from: entity.effectiveFrom ?? null,
      effective_until: entity.effectiveUntil ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_compliance.policy_documents')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_compliance.policy_documents')
        .values({ ...row, created_at: new Date().toISOString() } as any)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): PolicyDocument {
    return new PolicyDocument({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      title: row.title as string,
      documentType: row.document_type as string,
      documentVersion: row.document_version as string,
      content: (row.content as Record<string, unknown>) ?? {},
      effectiveFrom: row.effective_from ? new Date(row.effective_from as string) : undefined,
      effectiveUntil: row.effective_until ? new Date(row.effective_until as string) : undefined,
      status: row.status as PolicyDocument['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
