import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { LegalHold } from '../aggregates/legal-hold.aggregate.js';

/**
 * Repository for {@link LegalHold} aggregates.
 *
 * Uses the Kysely `hr_compliance.legal_holds` table.
 */
@Injectable()
export class LegalHoldRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<LegalHold | undefined> {
    const row = await this.db
      .selectFrom('hr_compliance.legal_holds')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findActiveByWorker(workerId: Uuid): Promise<LegalHold[]> {
    const rows = await this.db
      .selectFrom('hr_compliance.legal_holds')
      .selectAll()
      .where('status', '=', 'ACTIVE')
      .execute();
    return rows
      .map((r: any) => this.toAggregate(r))
      .filter((h) => h.affectedWorkerIds.some((id) => id.value === workerId.value));
  }

  /**
   * Tenant-scoped active holds affecting a worker. Used by the legal-hold
   * guard to enforce hold blocking on deletion/erasure within a single tenant.
   */
  async findActiveByWorkerForTenant(workerId: Uuid, tenantId: Uuid): Promise<LegalHold[]> {
    const rows = await this.db
      .selectFrom('hr_compliance.legal_holds')
      .selectAll()
      .where('status', '=', 'ACTIVE')
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows
      .map((r: any) => this.toAggregate(r))
      .filter((h) => h.affectedWorkerIds.some((id) => id.value === workerId.value));
  }

  async findActive(): Promise<LegalHold[]> {
    const rows = await this.db
      .selectFrom('hr_compliance.legal_holds')
      .selectAll()
      .where('status', '=', 'ACTIVE')
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: LegalHold): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_compliance.legal_holds')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      hold_name: entity.holdName,
      description: entity.description || null,
      reason: entity.reason,
      affected_worker_ids: entity.affectedWorkerIds.map((id) => id.value),
      placed_by: entity.placedBy.value,
      placed_at: entity.placedAt,
      released_by: entity.releasedBy?.value ?? null,
      released_at: entity.releasedAt ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_compliance.legal_holds')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_compliance.legal_holds')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): LegalHold {
    return new LegalHold({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      holdName: row.hold_name as string,
      description: (row.description as string) ?? undefined,
      reason: row.reason as string,
      affectedWorkerIds: Array.isArray(row.affected_worker_ids)
        ? (row.affected_worker_ids as string[]).map((id) => new Uuid(id))
        : [],
      placedBy: new Uuid(row.placed_by as string),
      placedAt: row.placed_at ? new Date(row.placed_at as string) : new Date(),
      releasedBy: row.released_by ? new Uuid(row.released_by as string) : undefined,
      releasedAt: row.released_at ? new Date(row.released_at as string) : undefined,
      status: row.status as LegalHold['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
