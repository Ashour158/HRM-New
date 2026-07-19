import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance, parseNumeric, resolveTransactionAwareExecutor } from '@hcm/database';
import { Offer, type OfferStatus } from '../aggregates/offer.aggregate.js';

/**
 * Repository for {@link Offer} aggregates.
 *
 * Uses the Kysely `hr_recruiting.offers` table as the authoritative store.
 */
@Injectable()
export class OfferRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Joins the ambient command-bus transaction when one is active (see
   * `resolveTransactionAwareExecutor` in `@hcm/database`), otherwise falls
   * back to this repository's own pooled connection. Writes through this
   * getter are atomic with the audit/outbox/idempotency rows the command bus
   * writes in the same transaction, and with any other aggregate this
   * repository is saved alongside within the same handler (e.g.
   * CreateOfferHandler's Offer + Candidate writes, AcceptOfferHandler's
   * Offer + Candidate + JobRequisition writes).
   */
  private get executor() {
    return resolveTransactionAwareExecutor<Database>(this.db);
  }

  /**
   * Find an offer by its unique identifier.
   */
  async findById(id: Uuid): Promise<Offer | undefined> {
    const row = await this.executor
      .selectFrom('hr_recruiting.offers')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find all offers for a given candidate.
   */
  async findByCandidate(candidateId: Uuid): Promise<Offer[]> {
    const rows = await this.executor
      .selectFrom('hr_recruiting.offers')
      .selectAll()
      .where('candidate_id', '=', candidateId.value)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Find all offers for a given requisition.
   */
  async findByRequisition(requisitionId: Uuid): Promise<Offer[]> {
    const rows = await this.executor
      .selectFrom('hr_recruiting.offers')
      .selectAll()
      .where('requisition_id', '=', requisitionId.value)
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Find all pending (non-terminal) offers.
   */
  async findPending(): Promise<Offer[]> {
    const rows = await this.executor
      .selectFrom('hr_recruiting.offers')
      .selectAll()
      .where('status', 'in', ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT'])
      .execute();

    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Persist an Offer aggregate (insert or update).
   */
  async save(entity: Offer): Promise<void> {
    const existing = await this.executor
      .selectFrom('hr_recruiting.offers')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      candidate_id: entity.candidateId.value,
      requisition_id: entity.requisitionId.value,
      proposed_salary: entity.proposedSalary,
      currency: entity.currency,
      start_date: entity.startDate.toISOString(),
      benefits_package: entity.benefitsPackage ?? null,
      status: entity.status,
      sent_at: entity.sentAt ? entity.sentAt.toISOString() : null,
      accepted_at: entity.acceptedAt ? entity.acceptedAt.toISOString() : null,
      declined_at: entity.declinedAt ? entity.declinedAt.toISOString() : null,
      proposed_by: entity.proposedBy?.value ?? null,
      approved_by: entity.approvedBy?.value ?? null,
      aggregate_version: entity.version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.executor
        .updateTable('hr_recruiting.offers')
        .set(row as never)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.executor
        .insertInto('hr_recruiting.offers')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): Offer {
    // Uses `rehydrate`, not `create` — `create` unconditionally resets
    // status to DRAFT and re-emits OfferCreated, which would silently
    // discard the persisted status on every read.
    return Offer.rehydrate({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      candidateId: new Uuid(row.candidate_id as string),
      requisitionId: new Uuid(row.requisition_id as string),
      proposedSalary: parseNumeric(row.proposed_salary as string | number),
      currency: row.currency as string,
      startDate: new Date(row.start_date as string),
      benefitsPackage: (row.benefits_package as Record<string, unknown>) ?? undefined,
      status: (row.status as OfferStatus) ?? undefined,
      sentAt: row.sent_at ? new Date(row.sent_at as string) : undefined,
      acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : undefined,
      declinedAt: row.declined_at ? new Date(row.declined_at as string) : undefined,
      proposedBy: row.proposed_by ? new Uuid(row.proposed_by as string) : undefined,
      approvedBy: row.approved_by ? new Uuid(row.approved_by as string) : undefined,
      aggregateVersion: (row.aggregate_version as number) ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
