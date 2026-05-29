import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import type { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { HcmSetupConfig } from './hcm-setup.types.js';

@Injectable()
export class HcmSetupRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async getByTenant(tenantId: Uuid): Promise<HcmSetupConfig | undefined> {
    const row = await this.db
      .selectFrom('hcm_setup_configs')
      .select(['config'])
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();

    return row?.config as HcmSetupConfig | undefined;
  }

  async upsert(tenantId: Uuid, config: HcmSetupConfig): Promise<void> {
    await this.db
      .insertInto('hcm_setup_configs')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        config: config as unknown,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .onConflict((oc) =>
        oc.column('tenant_id').doUpdateSet({
          config: config as unknown,
          updated_at: new Date().toISOString(),
        }),
      )
      .execute();
  }
}
