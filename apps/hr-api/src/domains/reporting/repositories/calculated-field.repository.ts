import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { CalculatedField } from '../aggregates/calculated-field.aggregate.js';

@Injectable()
export class CalculatedFieldRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid): Promise<CalculatedField | undefined> {
    const row = await this.db.selectFrom('hr_reporting.calculated_fields').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByIdForTenant(id: Uuid, tenantId: Uuid): Promise<CalculatedField | undefined> {
    const row = await this.db
      .selectFrom('hr_reporting.calculated_fields')
      .selectAll()
      .where('id', '=', id.value)
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByStatus(status: string): Promise<CalculatedField[]> {
    const rows = await this.db.selectFrom('hr_reporting.calculated_fields').selectAll().where('status', '=', status).execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async findByStatusForTenant(status: string, tenantId: Uuid): Promise<CalculatedField[]> {
    const rows = await this.db
      .selectFrom('hr_reporting.calculated_fields')
      .selectAll()
      .where('status', '=', status)
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: CalculatedField): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_reporting.calculated_fields')
      .select('id')
      .where('id', '=', entity.id.value)
      .where('tenant_id', '=', entity.tenantId.value)
      .executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      field_name: entity.fieldName,
      expression: entity.expression,
      data_type: entity.dataType,
      source_fields: JSON.stringify(entity.sourceFields ?? []),
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db
        .updateTable('hr_reporting.calculated_fields')
        .set(row)
        .where('id', '=', entity.id.value)
        .where('tenant_id', '=', entity.tenantId.value)
        .execute();
    } else {
      await this.db.insertInto('hr_reporting.calculated_fields').values({ ...row, created_at: new Date().toISOString() } as never).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): CalculatedField {
    return new CalculatedField({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      fieldName: row.field_name as string,
      expression: row.expression as string,
      dataType: row.data_type as string,
      sourceFields: (row.source_fields as string[]) ?? [],
      status: row.status as CalculatedField['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
