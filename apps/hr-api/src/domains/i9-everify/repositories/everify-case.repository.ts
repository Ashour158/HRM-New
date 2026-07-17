import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
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

  async findById(id: Uuid): Promise<EverifyCase | undefined> {
    const row = await this.db
      .selectFrom('hr_i9_everify.everify_cases')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByI9Case(i9CaseId: Uuid): Promise<EverifyCase[]> {
    const rows = await this.db
      .selectFrom('hr_i9_everify.everify_cases')
      .selectAll()
      .where('i9_case_id', '=', i9CaseId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async findByWorker(workerId: Uuid): Promise<EverifyCase[]> {
    const rows = await this.db
      .selectFrom('hr_i9_everify.everify_cases')
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: EverifyCase): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_i9_everify.everify_cases')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
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
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_i9_everify.everify_cases')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_i9_everify.everify_cases')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
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
