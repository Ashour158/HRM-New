import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import type { TenantConfig } from '@hcm/platform-core';
import { TenantValidator, tenantResolver } from '@hcm/platform-core';
import { makeError } from '../command-bus-errors.js';

/** Resolves and validates the tenant a command targets. */
export class TenantResolutionStep {
  constructor(private readonly tenantValidator: TenantValidator) {}

  async resolveTenant(command: HrCommandEnvelope<unknown>): Promise<TenantConfig> {
    const request = { headers: { 'x-tenant-id': command.tenantId.value } };
    const result = await tenantResolver.resolve(request);
    if (result.isErr()) {
      throw makeError(command, CommandPipelineStep.RESOLVE_TENANT, 'TENANT_RESOLUTION_FAILED', (result as { error: { message: string } }).error.message, false);
    }
    const config = await this.tenantValidator.getTenantConfig(command.tenantId);
    if (!config) {
      throw makeError(command, CommandPipelineStep.RESOLVE_TENANT, 'TENANT_NOT_FOUND', 'Tenant configuration not found', false);
    }
    return config;
  }

  async validateModuleEnabled(
    command: HrCommandEnvelope<unknown>,
    tenantConfig: TenantConfig,
  ): Promise<void> {
    if (tenantConfig.status !== 'ACTIVE') {
      throw makeError(command, CommandPipelineStep.VALIDATE_TENANT_MODULE_ENABLED, 'TENANT_INACTIVE', 'Tenant is not active', false);
    }
    const moduleCode = command.aggregateType.toUpperCase();
    if (tenantConfig.enabledModules.length > 0 && !tenantConfig.enabledModules.includes(moduleCode)) {
      throw makeError(command, CommandPipelineStep.VALIDATE_TENANT_MODULE_ENABLED, 'MODULE_DISABLED', `Module ${moduleCode} is not enabled`, false);
    }
  }
}
