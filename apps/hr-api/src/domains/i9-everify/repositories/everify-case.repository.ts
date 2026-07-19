import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { ConflictError, Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance, getCurrentTenantId } from '@hcm/database';
import { EverifyCase } from '../aggregates/everify-case.aggregate.js';

/**
 * Repository for {@link EverifyCase} aggregates.
 *
 * Uses the Kysely `hr_i9_everify.everify_cases` table.
 */
@Injectable()
export class EverifyCaseRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  /**
   * Reads the active request-scoped tenant from AsyncLocalStorage (see
   * `@hcm/database`'s `tenant-context.ts`, populated by `TenantInterceptor` for
   * HTTP requests and by explicit `runWithTenant` wraps for background/saga
   * callers). Every read/write below scopes on this - never on a value carried
   * by the in-memory aggregate - so a mis-constructed aggregate can never read
   * or silently persist under the wrong tenant.
   */
  private requireTenantId(): Uuid {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for E-Verify case query');
    }
    return tenantId;
  }

  async findById(id: Uuid): Promise<EverifyCase | undefined> {
    const tenantId = this.requireTenantId();
    const row = await this.db
      .selectFrom('hr_i9_everify.everify_cases')
      .selectAll()
      .where('id', '=', id.value)
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByI9Case(i9CaseId: Uuid): Promise<EverifyCase[]> {
    const tenantId = this.requireTenantId();
    const rows = await this.db
      .selectFrom('hr_i9_everify.everify_cases')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('i9_case_id', '=', i9CaseId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async findByWorker(workerId: Uuid): Promise<EverifyCase[]> {
    const tenantId = this.requireTenantId();
    const rows = await this.db
      .selectFrom('hr_i9_everify.everify_cases')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  /**
   * Atomically inserts or updates the EverifyCase row in a single statement
   * instead of the previous select-then-branch (which raced: two concurrent
   * saves of a brand-new aggregate could both observe "not found" and both
   * attempt an insert, and two concurrent updates of the same loaded version
   * could silently clobber one another since `aggregate_version` was written
   * but never checked). The `ON CONFLICT ... DO UPDATE ... WHERE` predicate
   * guards on both `tenant_id` and `aggregate_version` (the version the
   * aggregate was *loaded* at, not its post-transition version) - matching the
   * optimistic concurrency pattern established by `BaseRepository.update`'s
   * `expectedVersion` option elsewhere in this codebase (see e.g.
   * `PayrollCycleRepository.save` / `CompensationChangeRepository.save`). If
   * the guard doesn't match (concurrent writer won, or the row belongs to a
   * different tenant), zero rows come back and we raise `ConflictError`
   * instead of silently overwriting.
   */
  async save(entity: EverifyCase): Promise<void> {
    const tenantId = this.requireTenantId();
    const now = new Date().toISOString();
    const columns = {
      tenant_id: tenantId.value,
      worker_id: entity.workerId.value,
      i9_case_id: entity.i9CaseId.value,
      status: entity.status,
      case_number: entity.caseNumber ?? null,
      submitted_at: entity.submittedAt ?? null,
      simulated_determination: entity.simulatedDetermination ?? null,
      result: entity.result ?? null,
      result_recorded_at: entity.resultRecordedAt ?? null,
      result_recorded_by: entity.resultRecordedBy?.value ?? null,
      contested_at: entity.contestedAt ?? null,
      aggregate_version: entity.aggregateVersion,
      updated_at: now,
    };

    const result = await this.db
      .insertInto('hr_i9_everify.everify_cases')
      .values({ id: entity.id.value, ...columns, created_at: now } as never)
      .onConflict((oc) =>
        oc
          .column('id')
          .doUpdateSet(columns as never)
          .where('tenant_id', '=', tenantId.value)
          .where('aggregate_version', '=', entity.loadedVersion),
      )
      .returningAll()
      .executeTakeFirst();

    if (!result) {
      throw new ConflictError(
        `Optimistic concurrency conflict saving EverifyCase ${entity.id.value}: expected version ${entity.loadedVersion} but the row has since changed`,
        { table: 'hr_i9_everify.everify_cases', id: entity.id.value, expectedVersion: entity.loadedVersion },
      );
    }
    entity.markPersisted();
  }

  private toAggregate(row: Record<string, unknown>): EverifyCase {
    return new EverifyCase({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      workerId: new Uuid(row.worker_id as string),
      i9CaseId: new Uuid(row.i9_case_id as string),
      status: row.status as EverifyCase['status'],
      caseNumber: (row.case_number as string) ?? undefined,
      submittedAt: row.submitted_at ? new Date(row.submitted_at as string) : undefined,
      simulatedDetermination: (row.simulated_determination as EverifyCase['simulatedDetermination']) ?? undefined,
      result: (row.result as EverifyCase['result']) ?? undefined,
      resultRecordedAt: row.result_recorded_at ? new Date(row.result_recorded_at as string) : undefined,
      resultRecordedBy: row.result_recorded_by ? new Uuid(row.result_recorded_by as string) : undefined,
      contestedAt: row.contested_at ? new Date(row.contested_at as string) : undefined,
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
