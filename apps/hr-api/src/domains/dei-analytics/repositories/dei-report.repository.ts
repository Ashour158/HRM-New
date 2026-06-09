import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { DeiReport } from '../aggregates/dei-report.aggregate.js';

@Injectable()
export class DeiReportRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid): Promise<DeiReport | undefined> {
    const row = await this.db.selectFrom('hr_dei_analytics.dei_reports').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByStatus(status: string): Promise<DeiReport[]> {
    const rows = await this.db.selectFrom('hr_dei_analytics.dei_reports').selectAll().where('status', '=', status).execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: DeiReport): Promise<void> {
    const existing = await this.db.selectFrom('hr_dei_analytics.dei_reports').select('id').where('id', '=', entity.id.value).executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      report_type: entity.reportType,
      reporting_period: entity.reportingPeriod,
      country_code: entity.countryCode,
      legal_entity_id: entity.legalEntityId.value,
      metrics: entity.metrics,
      aggregation_threshold: entity.aggregationThreshold,
      suppression_applied: entity.suppressionApplied,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db.updateTable('hr_dei_analytics.dei_reports').set(row).where('id', '=', entity.id.value).execute();
    } else {
      await this.db.insertInto('hr_dei_analytics.dei_reports').values({ ...row, created_at: new Date().toISOString() } as never).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): DeiReport {
    return new DeiReport({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      reportType: row.report_type as string,
      reportingPeriod: row.reporting_period as string,
      countryCode: row.country_code as string,
      legalEntityId: new Uuid(row.legal_entity_id as string),
      metrics: (row.metrics as Record<string, unknown>) ?? {},
      aggregationThreshold: (row.aggregation_threshold as number) ?? 5,
      suppressionApplied: (row.suppression_applied as boolean) ?? false,
      status: row.status as DeiReport['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
