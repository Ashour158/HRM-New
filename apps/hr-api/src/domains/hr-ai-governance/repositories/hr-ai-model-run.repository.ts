import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { HrAiModelRun } from '../aggregates/hr-ai-model-run.aggregate.js';

@Injectable()
export class HrAiModelRunRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid): Promise<HrAiModelRun | undefined> {
    const row = await this.db.selectFrom('hr_ai.hr_ai_model_runs').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByUseCaseId(useCaseId: Uuid): Promise<HrAiModelRun[]> {
    const rows = await this.db.selectFrom('hr_ai.hr_ai_model_runs').selectAll().where('use_case_id', '=', useCaseId.value).execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: HrAiModelRun): Promise<void> {
    const existing = await this.db.selectFrom('hr_ai.hr_ai_model_runs').select('id').where('id', '=', entity.id.value).executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      use_case_id: entity.useCaseId.value,
      model_version: entity.modelVersion,
      input_data_snapshot: entity.inputDataSnapshot,
      output_data_snapshot: entity.outputDataSnapshot,
      run_at: entity.runAt ?? null,
      completed_at: entity.completedAt ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db.updateTable('hr_ai.hr_ai_model_runs').set(row).where('id', '=', entity.id.value).execute();
    } else {
      await this.db.insertInto('hr_ai.hr_ai_model_runs').values({ ...row, created_at: new Date().toISOString() } as never).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): HrAiModelRun {
    return new HrAiModelRun({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      useCaseId: new Uuid(row.use_case_id as string),
      modelVersion: row.model_version as string,
      inputDataSnapshot: (row.input_data_snapshot as Record<string, unknown>) ?? {},
      outputDataSnapshot: (row.output_data_snapshot as Record<string, unknown>) ?? {},
      runAt: row.run_at ? new Date(row.run_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      status: row.status as HrAiModelRun['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
