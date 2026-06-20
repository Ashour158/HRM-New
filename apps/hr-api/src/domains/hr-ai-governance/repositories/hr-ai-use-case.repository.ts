import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { HrAiUseCase } from '../aggregates/hr-ai-use-case.aggregate.js';

@Injectable()
export class HrAiUseCaseRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid, tenantId: Uuid): Promise<HrAiUseCase | undefined> {
    const row = await this.db.selectFrom('hr_ai.hr_ai_use_cases').selectAll().where('id', '=', id.value).where('tenant_id', '=', tenantId.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByStatus(status: string, tenantId: Uuid): Promise<HrAiUseCase[]> {
    const rows = await this.db.selectFrom('hr_ai.hr_ai_use_cases').selectAll().where('status', '=', status).where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async findByTenant(tenantId: Uuid): Promise<HrAiUseCase[]> {
    const rows = await this.db.selectFrom('hr_ai.hr_ai_use_cases').selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: HrAiUseCase): Promise<void> {
    const existing = await this.db.selectFrom('hr_ai.hr_ai_use_cases').select('id').where('id', '=', entity.id.value).where('tenant_id', '=', entity.tenantId.value).executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      use_case_name: entity.useCaseName,
      use_case_type: entity.useCaseType,
      risk_classification: entity.riskClassification,
      description: entity.description,
      data_usage: entity.dataUsage,
      human_oversight_required: entity.humanOversightRequired,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db.updateTable('hr_ai.hr_ai_use_cases').set(row).where('id', '=', entity.id.value).where('tenant_id', '=', entity.tenantId.value).execute();
    } else {
      await this.db.insertInto('hr_ai.hr_ai_use_cases').values({ ...row, created_at: new Date().toISOString() } as never).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): HrAiUseCase {
    return new HrAiUseCase({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      useCaseName: row.use_case_name as string,
      useCaseType: row.use_case_type as string,
      riskClassification: row.risk_classification as 'LOW' | 'MEDIUM' | 'HIGH' | 'UNACCEPTABLE',
      description: row.description as string | undefined,
      dataUsage: (row.data_usage as Record<string, unknown>) ?? {},
      humanOversightRequired: (row.human_oversight_required as boolean) ?? false,
      status: row.status as HrAiUseCase['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
