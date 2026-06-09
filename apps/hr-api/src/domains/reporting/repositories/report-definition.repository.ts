import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { ReportDefinition } from '../aggregates/report-definition.aggregate.js';

@Injectable()
export class ReportDefinitionRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid): Promise<ReportDefinition | undefined> {
    const row = await this.db.selectFrom('hr_reporting.report_definitions').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByStatus(status: string): Promise<ReportDefinition[]> {
    const rows = await this.db.selectFrom('hr_reporting.report_definitions').selectAll().where('status', '=', status).execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: ReportDefinition): Promise<void> {
    const existing = await this.db.selectFrom('hr_reporting.report_definitions').select('id').where('id', '=', entity.id.value).executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      report_name: entity.reportName,
      report_type: entity.reportType,
      data_source: entity.dataSource,
      query_definition: entity.queryDefinition,
      parameters: entity.parameters,
      schedule: entity.schedule,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db.updateTable('hr_reporting.report_definitions').set(row).where('id', '=', entity.id.value).execute();
    } else {
      await this.db.insertInto('hr_reporting.report_definitions').values({ ...row, created_at: new Date().toISOString() } as never).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): ReportDefinition {
    return new ReportDefinition({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      reportName: row.report_name as string,
      reportType: row.report_type as string,
      dataSource: row.data_source as string,
      queryDefinition: (row.query_definition as Record<string, unknown>) ?? {},
      parameters: (row.parameters as Record<string, unknown>) ?? {},
      schedule: (row.schedule as Record<string, unknown>) ?? {},
      status: row.status as ReportDefinition['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
