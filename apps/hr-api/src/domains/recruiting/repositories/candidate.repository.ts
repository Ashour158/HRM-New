import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { Candidate, type CandidateStatus } from '../aggregates/candidate.aggregate.js';

/**
 * Repository for {@link Candidate} aggregates.
 *
 * Uses the Kysely `hr_recruiting.candidates` table as the authoritative store.
 */
@Injectable()
export class CandidateRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Find a candidate by its unique identifier.
   */
  async findById(id: Uuid): Promise<Candidate | undefined> {
    const row = await this.db
      .selectFrom('hr_recruiting.candidates')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find a candidate by email address (scoped to tenant implicitly via query).
   */
  async findByEmail(email: string): Promise<Candidate | undefined> {
    const row = await this.db
      .selectFrom('hr_recruiting.candidates')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    return row ? this.toAggregate(row) : undefined;
  }

  /**
   * Find all candidates for a given requisition.
   */
  async findByRequisition(requisitionId: Uuid): Promise<Candidate[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.candidates')
      .selectAll()
      .where('requisition_id', '=', requisitionId.value)
      .execute();

    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Find all candidates with a given status.
   */
  async findByStatus(status: CandidateStatus): Promise<Candidate[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.candidates')
      .selectAll()
      .where('status', '=', status)
      .execute();

    return rows.map((r) => this.toAggregate(r));
  }

  /**
   * Persist a Candidate aggregate (insert or update).
   */
  async save(entity: Candidate): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_recruiting.candidates')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      first_name: entity.firstName,
      last_name: entity.lastName,
      email: entity.email,
      phone: entity.phone ?? null,
      resume_url: entity.resumeUrl ?? null,
      source: entity.source ?? null,
      status: entity.status,
      requisition_id: entity.requisitionId.value,
      aggregate_version: entity.version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_recruiting.candidates')
        .set(row as never)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_recruiting.candidates')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): Candidate {
    return Candidate.create(
      {
        id: new Uuid(row.id as string),
        tenantId: new Uuid(row.tenant_id as string),
        firstName: row.first_name as string,
        lastName: row.last_name as string,
        email: row.email as string,
        phone: (row.phone as string) ?? undefined,
        resumeUrl: (row.resume_url as string) ?? undefined,
        source: (row.source as string) ?? undefined,
        status: (row.status as CandidateStatus) ?? undefined,
        requisitionId: new Uuid(row.requisition_id as string),
        aggregateVersion: (row.aggregate_version as number) ?? undefined,
        createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
      },
      Uuid.generate(),
    );
  }
}
