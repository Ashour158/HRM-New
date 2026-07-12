import type { Kysely, Insertable, Transaction, Updateable } from 'kysely';
import { ConflictError, type Uuid } from '@hcm/shared-kernel';
import type { Database } from '../kysely/database.js';
import { getCurrentTenantId } from '../connection/tenant-context.js';
import { getCurrentTransaction } from '../connection/transaction-context.js';

type LooseDatabase = Record<string, Record<string, unknown>>;
type LooseExecutor = Kysely<LooseDatabase> | Transaction<LooseDatabase>;

/**
 * Tables that carry a `tenant_id` column. All CRUD operations (`findById`,
 * `findAll`, `insert`, `update`, `delete`) enforce tenant scoping, so the base
 * class is constrained to tenant-owned tables to keep that guarantee type-safe
 * for future subclasses.
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
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for findById');
    }
    const result = await this.queryExecutor
      .selectFrom(this.table)
      .selectAll()
      .where('id', '=', id.value)
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();
    return result as unknown as TAggregate | undefined;
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<TAggregate[]> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for findAll');
    }
    let query = this.queryExecutor
      .selectFrom(this.table)
      .selectAll()
      .where('tenant_id', '=', tenantId.value);
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

  /**
   * @param options.expectedVersion When provided, guards the UPDATE with
   *   `WHERE aggregate_version = expectedVersion` so two concurrent writers
   *   who both loaded the same version can't silently overwrite one another
   *   (only the first write succeeds; the second gets a `ConflictError`
   *   instead of clobbering it). Pass the aggregate's `loadedVersion`
   *   (its version *before* any in-memory transitions), not its current
   *   `version`. Omit only for tables that don't carry an
   *   `aggregate_version` column.
   */
  async update(
    id: Uuid,
    row: Updateable<Database[TTable]>,
    options?: { expectedVersion?: number },
  ): Promise<TAggregate | undefined> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for update');
    }

    let query = this.queryExecutor
      .updateTable(this.table)
      // Never allow a caller-supplied tenant_id to override the active tenant context.
      .set({ ...(row as unknown as Record<string, unknown>), tenant_id: tenantId.value })
      .where('id', '=', id.value)
      .where('tenant_id', '=', tenantId.value);

    if (options?.expectedVersion !== undefined) {
      query = query.where('aggregate_version', '=', options.expectedVersion);
    }

    const result = await query.returningAll().executeTakeFirst();

    if (!result && options?.expectedVersion !== undefined) {
      const current = await this.findById(id);
      if (current) {
        throw new ConflictError(
          `Optimistic concurrency conflict updating ${this.table} ${id.value}: expected version ${options.expectedVersion} but the row has since changed`,
          { table: this.table, id: id.value, expectedVersion: options.expectedVersion },
        );
      }
    }

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
