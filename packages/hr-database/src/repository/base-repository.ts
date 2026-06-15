import type { Kysely, Insertable, Transaction, Updateable } from 'kysely';
import type { Uuid } from '@hcm/shared-kernel';
import type { Database } from '../kysely/database.js';
import { getCurrentTenantId } from '../connection/tenant-context.js';
import { getCurrentTransaction } from '../connection/transaction-context.js';

type LooseDatabase = Record<string, Record<string, unknown>>;
type LooseExecutor = Kysely<LooseDatabase> | Transaction<LooseDatabase>;

/**
 * Tables that carry a `tenant_id` column. `update()`/`delete()` enforce tenant
 * scoping, so the base class is constrained to tenant-owned tables to keep that
 * guarantee type-safe for future subclasses.
 */
export type TenantTableNames = {
  [K in keyof Database]: 'tenant_id' extends keyof Database[K] ? K : never;
}[keyof Database];

export abstract class BaseRepository<TTable extends TenantTableNames, TAggregate = Database[TTable]> {
  protected abstract readonly tableName: TTable;

  constructor(protected readonly db: Kysely<Database>) {}

  protected get executor(): Kysely<Database> | Transaction<Database> {
    return getCurrentTransaction() ?? this.db;
  }

  private get queryExecutor(): LooseExecutor {
    return this.executor as unknown as LooseExecutor;
  }

  private get table(): string {
    return String(this.tableName);
  }

  async findById(id: Uuid): Promise<TAggregate | undefined> {
    const result = await this.queryExecutor
      .selectFrom(this.table)
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return result as unknown as TAggregate | undefined;
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<TAggregate[]> {
    let query = this.queryExecutor.selectFrom(this.table).selectAll();
    if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }
    if (options?.offset !== undefined) {
      query = query.offset(options.offset);
    }
    const results = await query.execute();
    return results as unknown as TAggregate[];
  }

  async insert(row: Insertable<Database[TTable]>): Promise<TAggregate> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for insert');
    }

    const result = await this.queryExecutor
      .insertInto(this.table)
      .values({ ...(row as unknown as Record<string, unknown>), tenant_id: tenantId.value })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result as unknown as TAggregate;
  }

  async update(id: Uuid, row: Updateable<Database[TTable]>): Promise<TAggregate | undefined> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for update');
    }

    const result = await this.queryExecutor
      .updateTable(this.table)
      // Never allow a caller-supplied tenant_id to override the active tenant context.
      .set({ ...(row as unknown as Record<string, unknown>), tenant_id: tenantId.value })
      .where('id', '=', id.value)
      .where('tenant_id', '=', tenantId.value)
      .returningAll()
      .executeTakeFirst();

    return result as unknown as TAggregate | undefined;
  }

  async delete(id: Uuid): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for delete');
    }

    const result = await this.queryExecutor
      .deleteFrom(this.table)
      .where('id', '=', id.value)
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();

    return Number((result as unknown as { numDeletedRows: bigint }).numDeletedRows) > 0;
  }
}
