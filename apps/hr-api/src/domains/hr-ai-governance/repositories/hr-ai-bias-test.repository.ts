import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { HrAiBiasTest } from '../aggregates/hr-ai-bias-test.aggregate.js';

@Injectable()
export class HrAiBiasTestRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid): Promise<HrAiBiasTest | undefined> {
    const row = await this.db.selectFrom('hr_ai.hr_ai_bias_tests').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByUseCaseId(useCaseId: Uuid): Promise<HrAiBiasTest[]> {
    const rows = await this.db.selectFrom('hr_ai.hr_ai_bias_tests').selectAll().where('use_case_id', '=', useCaseId.value).execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: HrAiBiasTest): Promise<void> {
    const existing = await this.db.selectFrom('hr_ai.hr_ai_bias_tests').select('id').where('id', '=', entity.id.value).executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      use_case_id: entity.useCaseId.value,
      test_type: entity.testType,
      test_data: entity.testData,
      metrics: entity.metrics,
      threshold: entity.threshold,
      passed: entity.passed,
      executed_at: entity.executedAt ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db.updateTable('hr_ai.hr_ai_bias_tests').set(row).where('id', '=', entity.id.value).execute();
    } else {
      await this.db.insertInto('hr_ai.hr_ai_bias_tests').values({ ...row, created_at: new Date().toISOString() } as never).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): HrAiBiasTest {
    return new HrAiBiasTest({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      useCaseId: new Uuid(row.use_case_id as string),
      testType: row.test_type as string,
      testData: (row.test_data as Record<string, unknown>) ?? {},
      metrics: (row.metrics as Record<string, unknown>) ?? {},
      threshold: (row.threshold as number) ?? 0.05,
      passed: (row.passed as boolean) ?? false,
      executedAt: row.executed_at ? new Date(row.executed_at as string) : undefined,
      status: row.status as HrAiBiasTest['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
