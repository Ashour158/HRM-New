import { Inject, Injectable, Optional } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { DEFAULT_HCM_SETUP } from './hcm-setup.defaults.js';
import { HcmSetupRepository } from './hcm-setup.repository.js';
import type { HcmSetupConfig, HcmSetupUpdate, RuntimePolicyRevisionEvidence } from './hcm-setup.types.js';

export interface HcmSetupStore {
  getByTenant(tenantId: Uuid): Promise<HcmSetupConfig | undefined>;
  upsert(tenantId: Uuid, config: HcmSetupConfig): Promise<void>;
}

function cloneSetup(setup: HcmSetupConfig): HcmSetupConfig {
  return JSON.parse(JSON.stringify(setup)) as HcmSetupConfig;
}

function sortedScopeValues(values: string[] | undefined): string[] {
  return [...(values ?? [])].sort();
}

function runtimePolicyRevisionKey(evidence: RuntimePolicyRevisionEvidence): string {
  const scope = evidence.scope ?? {};
  return JSON.stringify({
    area: evidence.area,
    tenantId: scope.tenantId ?? '',
    countryCodes: sortedScopeValues(scope.countryCodes),
    legalEntityIds: sortedScopeValues(scope.legalEntityIds),
    orgUnitIds: sortedScopeValues(scope.orgUnitIds),
    departmentIds: sortedScopeValues(scope.departmentIds),
    locationCodes: sortedScopeValues(scope.locationCodes),
    employeeTypes: sortedScopeValues(scope.employeeTypes),
    workerIds: sortedScopeValues(scope.workerIds),
    effectiveFrom: scope.effectiveFrom ?? '',
    effectiveUntil: scope.effectiveUntil ?? '',
  });
}

function mergeRuntimePolicyRevisions(
  existing: RuntimePolicyRevisionEvidence[] | undefined,
  incoming: RuntimePolicyRevisionEvidence[] | undefined,
): RuntimePolicyRevisionEvidence[] | undefined {
  if (!incoming) return existing;
  const byScope = new Map<string, RuntimePolicyRevisionEvidence>();
  for (const evidence of existing ?? []) {
    byScope.set(runtimePolicyRevisionKey(evidence), evidence);
  }
  for (const evidence of incoming) {
    byScope.set(runtimePolicyRevisionKey(evidence), evidence);
  }
  return Array.from(byScope.values());
}

function mergeSetup(...configs: Array<Partial<HcmSetupConfig> | undefined>): HcmSetupConfig {
  return configs.reduce<HcmSetupConfig>(
    (merged, config) => ({
      ...merged,
      ...(config ?? {}),
      employeeIdPolicy: {
        ...merged.employeeIdPolicy,
        ...(config?.employeeIdPolicy ?? {}),
      },
      payrollCalculationPolicy: {
        ...merged.payrollCalculationPolicy,
        ...(config?.payrollCalculationPolicy ?? {}),
      },
      attendancePolicy: {
        ...merged.attendancePolicy,
        ...(config?.attendancePolicy ?? {}),
      },
      runtimePolicyRevisions: mergeRuntimePolicyRevisions(
        merged.runtimePolicyRevisions,
        config?.runtimePolicyRevisions,
      ),
    }),
    cloneSetup(DEFAULT_HCM_SETUP),
  );
}

@Injectable()
export class HcmSetupService {
  constructor(
    @Optional() @Inject(HcmSetupRepository) private readonly repository: HcmSetupStore = new HcmSetupRepository(),
  ) {}

  async getSetup(tenantId: Uuid): Promise<HcmSetupConfig> {
    return mergeSetup(await this.repository.getByTenant(tenantId));
  }

  async updateSetup(tenantId: Uuid, update: HcmSetupUpdate): Promise<HcmSetupConfig> {
    const existing = await this.repository.getByTenant(tenantId);
    const setup = mergeSetup(existing, update);
    await this.repository.upsert(tenantId, setup);
    return setup;
  }
}
