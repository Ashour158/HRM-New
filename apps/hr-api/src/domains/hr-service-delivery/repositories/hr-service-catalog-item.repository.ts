import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { HrServiceCatalogItem, type HrServiceCatalogItemStatus } from '../aggregates/hr-service-catalog-item.aggregate.js';

@Injectable()
export class HrServiceCatalogItemRepository extends BaseRepository<'hr_service_catalog_items', HrServiceCatalogItem> {
  protected readonly tableName = 'hr_service_catalog_items' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<HrServiceCatalogItem | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['hr_service_catalog_items']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<HrServiceCatalogItem[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['hr_service_catalog_items']));
  }



  async save(entity: HrServiceCatalogItem): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['hr_service_catalog_items']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['hr_service_catalog_items']>);
    }
  }

  private toAggregate(row: Database['hr_service_catalog_items']): HrServiceCatalogItem {
    return new HrServiceCatalogItem({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      serviceName: row.service_name,
      serviceCode: row.id,
      description: row.description ?? '',
      category: 'GENERAL',
      slaHours: row.sla_hours ?? 0,
      fulfillmentProcess: '',
      status: row.status as HrServiceCatalogItemStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: HrServiceCatalogItem): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      service_name: entity.serviceName,
      service_type: 'GENERAL',
      description: entity.description ?? null,
      sla_hours: entity.slaHours ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
