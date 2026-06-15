import { Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import type { Kysely } from 'kysely';
import { resolveTenantTimezone } from '../../domains/hcm-setup/hcm-setup-currency.js';
import { DEFAULT_HCM_SETUP } from '../../domains/hcm-setup/hcm-setup.defaults.js';
import type { HcmSetupConfig } from '../../domains/hcm-setup/hcm-setup.types.js';
import type { ActiveTenant } from './scheduled-job.js';

@Injectable()
export class TenantDirectoryService {
  private readonly db: Kysely<Database>;

  constructor(@Optional() db?: Kysely<Database>) {
    this.db = db ?? createKyselyInstance(getPool());
  }

  async listActiveTenants(): Promise<ActiveTenant[]> {
    const rows = await this.db
      .selectFrom('tenants')
      .leftJoin('hcm_setup_configs', 'hcm_setup_configs.tenant_id', 'tenants.id')
      .select(['tenants.id as tenant_id', 'hcm_setup_configs.config as setup_config'])
      .where('tenants.status', '=', 'ACTIVE')
      .execute();

    return rows.map((row) => {
      const setup = {
        ...DEFAULT_HCM_SETUP,
        ...((row.setup_config ?? {}) as Partial<HcmSetupConfig>),
      };
      return {
        tenantId: new Uuid(row.tenant_id),
        timezone: resolveTenantTimezone(setup).label,
      };
    });
  }
}
