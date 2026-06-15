import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { SowEngagement, type SowEngagementStatus } from '../aggregates/sow-engagement.aggregate.js';

function stringArrayFromJsonb(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

@Injectable()
export class SowEngagementRepository extends BaseRepository<'sow_engagements', SowEngagement> {
  protected readonly tableName = 'sow_engagements' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<SowEngagement | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['sow_engagements']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<SowEngagement[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['sow_engagements']));
  }

  async save(entity: SowEngagement): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['sow_engagements']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['sow_engagements']>);
    }
  }

  private toAggregate(row: Database['sow_engagements']): SowEngagement {
    return new SowEngagement({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      sowNumber: row.sow_number,
      vendorId: new Uuid(row.vendor_id),
      projectName: row.project_name,
      totalValue: row.total_value,
      currency: row.currency,
      startDate: row.start_date,
      endDate: row.end_date,
      milestones: stringArrayFromJsonb(row.milestones),
      status: row.status as SowEngagementStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: SowEngagement): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      sow_number: entity.sowNumber,
      vendor_id: entity.vendorId.value,
      project_name: entity.projectName,
      total_value: entity.totalValue,
      currency: entity.currency,
      start_date: entity.startDate,
      end_date: entity.endDate,
      milestones: entity.milestones ? JSON.stringify(entity.milestones) : null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
