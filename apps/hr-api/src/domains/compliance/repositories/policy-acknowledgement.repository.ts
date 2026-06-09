import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { PolicyAcknowledgement } from '../aggregates/policy-acknowledgement.aggregate.js';

/**
 * Repository for {@link PolicyAcknowledgement} aggregates.
 *
 * Uses the Kysely `hr_compliance.policy_acknowledgements` table.
 */
@Injectable()
export class PolicyAcknowledgementRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<PolicyAcknowledgement | undefined> {
    const row = await this.db
      .selectFrom('hr_compliance.policy_acknowledgements')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<PolicyAcknowledgement[]> {
    const rows = await this.db
      .selectFrom('hr_compliance.policy_acknowledgements')
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async findByPolicyDocument(policyDocumentId: Uuid): Promise<PolicyAcknowledgement[]> {
    const rows = await this.db
      .selectFrom('hr_compliance.policy_acknowledgements')
      .selectAll()
      .where('policy_document_id', '=', policyDocumentId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: PolicyAcknowledgement): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_compliance.policy_acknowledgements')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      policy_document_id: entity.policyDocumentId.value,
      acknowledged_at: entity.acknowledgedAt ?? null,
      due_date: entity.dueDate ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_compliance.policy_acknowledgements')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_compliance.policy_acknowledgements')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): PolicyAcknowledgement {
    return new PolicyAcknowledgement({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      workerId: new Uuid(row.worker_id as string),
      policyDocumentId: new Uuid(row.policy_document_id as string),
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at as string) : undefined,
      dueDate: row.due_date ? new Date(row.due_date as string) : new Date(),
      status: row.status as PolicyAcknowledgement['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
