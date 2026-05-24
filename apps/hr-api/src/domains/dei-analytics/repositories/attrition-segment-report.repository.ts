import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { AttritionSegmentReport } from '../aggregates/attrition-segment-report.aggregate.js';

@Injectable()
export class AttritionSegmentReportRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid): Promise<AttritionSegmentReport | undefined> {
    const row = await this.db.selectFrom('hr_dei_analytics.attrition_segment_reports').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByStatus(status: string): Promise<AttritionSegmentReport[]> {
    const rows = await this.db.selectFrom('hr_dei_analytics.attrition_segment_reports').selectAll().where('status', '=', status).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: AttritionSegmentReport): Promise<void> {
    const existing = await this.db.selectFrom('hr_dei_analytics.attrition_segment_reports').select('id').where('id', '=', entity.id.value).executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      report_period: entity.reportPeriod,
      segment_type: entity.segmentType,
      segments: entity.segments,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db.updateTable('hr_dei_analytics.attrition_segment_reports').set(row).where('id', '=', entity.id.value).execute();
    } else {
      await this.db.insertInto('hr_dei_analytics.attrition_segment_reports').values({ ...row, created_at: new Date().toISOString() } as any).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): AttritionSegmentReport {
    return new AttritionSegmentReport({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      reportPeriod: row.report_period as string,
      segmentType: row.segment_type as string,
      segments: (row.segments as Record<string, unknown>) ?? {},
      status: row.status as AttritionSegmentReport['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
