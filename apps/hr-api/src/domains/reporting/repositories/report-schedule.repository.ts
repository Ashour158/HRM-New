import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { ReportSchedule } from '../aggregates/report-schedule.aggregate.js';

@Injectable()
export class ReportScheduleRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid): Promise<ReportSchedule | undefined> {
    const row = await this.db.selectFrom('hr_reporting.report_schedules').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByReportDefinitionId(reportDefinitionId: Uuid): Promise<ReportSchedule[]> {
    const rows = await this.db.selectFrom('hr_reporting.report_schedules').selectAll().where('report_definition_id', '=', reportDefinitionId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: ReportSchedule): Promise<void> {
    const existing = await this.db.selectFrom('hr_reporting.report_schedules').select('id').where('id', '=', entity.id.value).executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      report_definition_id: entity.reportDefinitionId.value,
      frequency: entity.frequency,
      recipients: entity.recipients,
      next_run_at: entity.nextRunAt ?? null,
      last_run_at: entity.lastRunAt ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db.updateTable('hr_reporting.report_schedules').set(row).where('id', '=', entity.id.value).execute();
    } else {
      await this.db.insertInto('hr_reporting.report_schedules').values({ ...row, created_at: new Date().toISOString() } as never).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): ReportSchedule {
    return new ReportSchedule({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      reportDefinitionId: new Uuid(row.report_definition_id as string),
      frequency: row.frequency as string,
      recipients: (row.recipients as string[]) ?? [],
      nextRunAt: row.next_run_at ? new Date(row.next_run_at as string) : undefined,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at as string) : undefined,
      status: row.status as ReportSchedule['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
