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
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('service_name', 'asc')
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['hr_service_catalog_items']));
  }

  async findActive(tenantId: Uuid): Promise<HrServiceCatalogItem[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('status', '=', 'ACTIVE')
      .orderBy('service_name', 'asc')
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['hr_service_catalog_items']));
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
      serviceCode: row.service_code,
      description: row.description ?? '',
      category: row.category ?? row.service_type,
      slaHours: row.sla_hours ?? 0,
      fulfillmentProcess: row.fulfillment_process ?? '',
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
      service_code: entity.serviceCode,
      service_name: entity.serviceName,
      service_type: entity.category,
      description: entity.description ?? null,
      category: entity.category,
      sla_hours: entity.slaHours ?? null,
      fulfillment_process: entity.fulfillmentProcess,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
