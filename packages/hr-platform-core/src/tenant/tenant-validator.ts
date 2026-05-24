/**
 * Tenant validation services.
 */

import { Uuid, Result, Ok, Err } from '@hcm/shared-kernel';
import { DomainError } from '@hcm/shared-kernel';
import type { Kysely } from 'kysely';
import type { Database } from '@hcm/database';

/**
 * Error raised when the requested tenant is inactive.
 */
export class TenantInactiveError extends DomainError {
  readonly code = 'TENANT_INACTIVE';

  constructor(tenantId: Uuid) {
    super(`Tenant ${tenantId.value} is inactive`, { tenantId: tenantId.value });
  }
}

/**
 * Error raised when a module is not enabled for the tenant.
 */
export class ModuleDisabledError extends DomainError {
  readonly code = 'MODULE_DISABLED';

  constructor(moduleCode: string, tenantId: Uuid) {
    super(`Module ${moduleCode} is not enabled for tenant ${tenantId.value}`, {
      moduleCode,
      tenantId: tenantId.value,
    });
  }
}

/**
 * Snapshot of a tenant's configuration.
 */
export interface TenantConfig {
  id: Uuid;
  name: string;
  slug: string;
  status: string;
  enabledModules: string[];
  settings: Record<string, unknown>;
}

/**
 * Validates tenant state and module availability.
 */
export class TenantValidator {
  /**
   * @param db - A Kysely instance for the platform database.
   */
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Verifies that the tenant exists and is active.
   * @param tenantId - The tenant to validate.
   * @returns An Ok void or a {@link TenantInactiveError}.
   */
  async validateTenantActive(tenantId: Uuid): Promise<Result<void, TenantInactiveError>> {
    const config = await this.getTenantConfig(tenantId);
    if (!config || config.status !== 'ACTIVE') {
      return new Err(new TenantInactiveError(tenantId));
    }
    return new Ok(undefined);
  }

  /**
   * Verifies that a specific module is enabled for the tenant.
   * @param tenantId - The tenant to validate.
   * @param moduleCode - The module code (e.g., 'PAYROLL').
   * @returns An Ok void or a {@link ModuleDisabledError}.
   */
  async validateTenantModuleEnabled(
    tenantId: Uuid,
    moduleCode: string
  ): Promise<Result<void, ModuleDisabledError>> {
    const config = await this.getTenantConfig(tenantId);
    if (!config || !config.enabledModules.includes(moduleCode)) {
      return new Err(new ModuleDisabledError(moduleCode, tenantId));
    }
    return new Ok(undefined);
  }

  /**
   * Fetches the tenant configuration row.
   * @param tenantId - The tenant to look up.
   * @returns The configuration or undefined if not found.
   */
  async getTenantConfig(tenantId: Uuid): Promise<TenantConfig | undefined> {
    const row = await this.db
      .selectFrom('tenants')
      .select(['id', 'name', 'slug', 'status'])
      .where('id', '=', tenantId.value)
      .executeTakeFirst();

    if (!row) {
      return undefined;
    }

    // Modules and settings are stored in separate columns or joined tables.
    // For the platform-core abstraction we project a simplified shape.
    return {
      id: new Uuid(row.id),
      name: row.name,
      slug: row.slug,
      status: row.status,
      enabledModules: [], // populated by downstream extenders if needed
      settings: {},
    };
  }
}
