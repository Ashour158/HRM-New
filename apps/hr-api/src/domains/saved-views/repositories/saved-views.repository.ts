import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import type { Insertable, Kysely, Selectable, Updateable } from 'kysely';
import { SavedView } from '../aggregates/saved-view.aggregate.js';

type SavedViewsTable = Database['hr_platform.saved_views'];
type SavedViewRow = Selectable<SavedViewsTable>;

@Injectable()
export class SavedViewsRepository {
  private readonly db: Kysely<Database>;
  private readonly tableName = 'hr_platform.saved_views' as const;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findByUserAndList(tenantId: Uuid, userId: Uuid, listKey: string): Promise<SavedView[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('user_id', '=', userId.value)
      .where('list_key', '=', listKey)
      .orderBy('is_default', 'desc')
      .orderBy('updated_at', 'desc')
      .execute();
    return rows.map((row) => this.toAggregate(row));
  }

  async findByIdForUser(tenantId: Uuid, userId: Uuid, id: Uuid): Promise<SavedView | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('user_id', '=', userId.value)
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async save(view: SavedView): Promise<SavedView> {
    const row = this.toRow(view);
    const saved = await this.db
      .insertInto(this.tableName)
      .values(row as Insertable<SavedViewsTable>)
      .onConflict((oc) => oc.column('id').doUpdateSet(row as Updateable<SavedViewsTable>))
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toAggregate(saved);
  }

  async unsetDefaultForList(tenantId: Uuid, userId: Uuid, listKey: string, exceptId?: Uuid): Promise<void> {
    let query = this.db
      .updateTable(this.tableName)
      .set({
        is_default: false,
        updated_at: new Date().toISOString(),
      } as Updateable<SavedViewsTable>)
      .where('tenant_id', '=', tenantId.value)
      .where('user_id', '=', userId.value)
      .where('list_key', '=', listKey);

    if (exceptId) {
      query = query.where('id', '!=', exceptId.value);
    }

    await query.execute();
  }

  async delete(tenantId: Uuid, userId: Uuid, id: Uuid): Promise<boolean> {
    const result = await this.db
      .deleteFrom(this.tableName)
      .where('tenant_id', '=', tenantId.value)
      .where('user_id', '=', userId.value)
      .where('id', '=', id.value)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  private toAggregate(row: SavedViewRow): SavedView {
    return SavedView.rehydrate({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      userId: new Uuid(row.user_id),
      listKey: row.list_key,
      name: row.name,
      filters: asRecord(row.filters),
      columns: asStringArray(row.columns),
      isDefault: row.is_default,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(view: SavedView): Record<string, unknown> {
    return {
      id: view.id.value,
      tenant_id: view.tenantId.value,
      user_id: view.userId.value,
      list_key: view.listKey,
      name: view.name,
      // jsonb columns: stringify so the pg driver does not coerce the JS array
      // (`columns`) into a Postgres array literal, which fails against jsonb.
      filters: JSON.stringify(view.filters),
      columns: JSON.stringify(view.columns),
      is_default: view.isDefault,
      aggregate_version: view.aggregateVersion,
      created_at: view.createdAt,
      updated_at: view.updatedAt,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
