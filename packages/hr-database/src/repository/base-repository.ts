import { Kysely, Insertable, Updateable } from 'kysely';
import type { Uuid } from '@hcm/shared-kernel';
import type { Database } from '../kysely/database.js';
import { getCurrentTenantId } from '../connection/tenant-context.js';

export abstract class BaseRepository<TTable extends keyof Database, TAggregate = Database[TTable]> {
  protected abstract readonly tableName: TTable;

  constructor(protected readonly db: Kysely<Database>) {}

  async findById(id: Uuid): Promise<TAggregate | undefined> {
    const result = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('id', '=', id as any)
      .executeTakeFirst();
    return result as unknown as TAggregate | undefined;
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<TAggregate[]> {
    let query = this.db.selectFrom(this.tableName).selectAll();
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

    const result = await this.db
      .insertInto(this.tableName)
      .values({ ...(row as unknown as Record<string, unknown>), tenant_id: tenantId } as unknown as Insertable<Database[TTable]>)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result as unknown as TAggregate;
  }

  async update(id: Uuid, row: Updateable<Database[TTable]>): Promise<TAggregate | undefined> {
    const result = await this.db
      .updateTable(this.tableName)
      .set(row as any)
      .where('id', '=', id as any)
      .returningAll()
      .executeTakeFirst();

    return result as unknown as TAggregate | undefined;
  }

  async delete(id: Uuid): Promise<boolean> {
    const result = await this.db
      .deleteFrom(this.tableName)
      .where('id', '=', id as any)
      .executeTakeFirst();

    return Number((result as unknown as { numDeletedRows: bigint }).numDeletedRows) > 0;
  }
}
