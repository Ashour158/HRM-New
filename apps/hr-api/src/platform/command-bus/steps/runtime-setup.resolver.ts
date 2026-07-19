import type { Kysely } from 'kysely';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { HcmSetupService } from '../../../domains/hcm-setup/hcm-setup.service.js';
import type { HcmSetupConfig, PolicyGovernanceConfig } from '../../../domains/hcm-setup/hcm-setup.types.js';

/**
 * Resolves the tenant's applied HCM setup config (policy governance overrides,
 * runtime policy revisions, etc). Shared by RuntimeGovernanceStep and
 * PolicyRevisionStep — and by the CommandBus orchestrator itself for the
 * approval-workflow gate — so there is exactly one place that implements the
 * "prefer HcmSetupService, fall back to a direct DB read" fallback.
 */
export class RuntimeSetupResolver {
  constructor(
    private readonly hcmSetup: Pick<HcmSetupService, 'getSetup'> | undefined,
    private readonly db: Kysely<Database>,
  ) {}

  async getSetup(command: HrCommandEnvelope<unknown>): Promise<Partial<HcmSetupConfig> | undefined> {
    if (this.hcmSetup) {
      return this.hcmSetup.getSetup(command.tenantId);
    }
    if (!this.db) return undefined;

    const row = await this.db
      .selectFrom('hcm_setup_configs')
      .select(['config'])
      .where('tenant_id', '=', command.tenantId.value)
      .executeTakeFirst();
    return row?.config as Partial<HcmSetupConfig> | undefined;
  }

  async getGovernance(command: HrCommandEnvelope<unknown>): Promise<PolicyGovernanceConfig | undefined> {
    return (await this.getSetup(command))?.policyGovernance;
  }
}
