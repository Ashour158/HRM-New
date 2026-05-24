import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { PayGapReport } from '../aggregates/pay-gap-report.aggregate.js';

@Injectable()
export class PayGapReportRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid): Promise<PayGapReport | undefined> {
    const row = await this.db.selectFrom('hr_dei_analytics.pay_gap_reports').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByStatus(status: string): Promise<PayGapReport[]> {
    const rows = await this.db.selectFrom('hr_dei_analytics.pay_gap_reports').selectAll().where('status', '=', status).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: PayGapReport): Promise<void> {
    const existing = await this.db.selectFrom('hr_dei_analytics.pay_gap_reports').select('id').where('id', '=', entity.id.value).executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      report_type: entity.reportType,
      reporting_year: entity.reportingYear,
      country_code: entity.countryCode,
      mean_hourly_gap: entity.meanHourlyGap ?? null,
      median_hourly_gap: entity.medianHourlyGap ?? null,
      quartile_distribution: entity.quartileDistribution,
      action_plan: entity.actionPlan,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db.updateTable('hr_dei_analytics.pay_gap_reports').set(row).where('id', '=', entity.id.value).execute();
    } else {
      await this.db.insertInto('hr_dei_analytics.pay_gap_reports').values({ ...row, created_at: new Date().toISOString() } as any).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): PayGapReport {
    return new PayGapReport({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      reportType: row.report_type as 'GENDER_PAY_GAP' | 'ETHNICITY_PAY_GAP',
      reportingYear: row.reporting_year as number,
      countryCode: row.country_code as string,
      meanHourlyGap: row.mean_hourly_gap as number | undefined,
      medianHourlyGap: row.median_hourly_gap as number | undefined,
      quartileDistribution: (row.quartile_distribution as Record<string, unknown>) ?? {},
      actionPlan: (row.action_plan as Record<string, unknown>) ?? {},
      status: row.status as PayGapReport['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
