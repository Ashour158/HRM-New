import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { RecognitionProgram, type RecognitionProgramStatus } from '../aggregates/recognition-program.aggregate.js';

@Injectable()
export class RecognitionProgramRepository extends BaseRepository<'recognition_programs', RecognitionProgram> {
  protected readonly tableName = 'recognition_programs' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<RecognitionProgram | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<RecognitionProgram[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: RecognitionProgram): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): RecognitionProgram {
    return new RecognitionProgram({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      programName: row.program_name,
      programType: row.program_type,
      budget: row.budget ?? undefined,
      currency: row.currency ?? undefined,
      status: (row.status as RecognitionProgramStatus) ?? 'ACTIVE',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: RecognitionProgram): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      program_name: entity.programName,
      program_type: entity.programType,
      budget: entity.budget ?? null,
      currency: entity.currency ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
