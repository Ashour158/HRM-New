import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { ReportExecution } from '../aggregates/report-execution.aggregate.js';

@Injectable()
export class ReportExecutionRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid): Promise<ReportExecution | undefined> {
    const row = await this.db.selectFrom('hr_reporting.report_executions').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByReportDefinitionId(reportDefinitionId: Uuid): Promise<ReportExecution[]> {
    const rows = await this.db.selectFrom('hr_reporting.report_executions').selectAll().where('report_definition_id', '=', reportDefinitionId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: ReportExecution): Promise<void> {
    const existing = await this.db.selectFrom('hr_reporting.report_executions').select('id').where('id', '=', entity.id.value).executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      report_definition_id: entity.reportDefinitionId.value,
      executed_by: entity.executedBy.value,
      parameters: entity.parameters,
      result_url: entity.resultUrl ?? null,
      row_count: entity.rowCount ?? null,
      started_at: entity.startedAt ?? null,
      completed_at: entity.completedAt ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db.updateTable('hr_reporting.report_executions').set(row).where('id', '=', entity.id.value).execute();
    } else {
      await this.db.insertInto('hr_reporting.report_executions').values({ ...row, created_at: new Date().toISOString() } as never).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): ReportExecution {
    return new ReportExecution({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      reportDefinitionId: new Uuid(row.report_definition_id as string),
      executedBy: new Uuid(row.executed_by as string),
      parameters: (row.parameters as Record<string, unknown>) ?? {},
      resultUrl: row.result_url as string | undefined,
      rowCount: row.row_count as number | undefined,
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      status: row.status as ReportExecution['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
