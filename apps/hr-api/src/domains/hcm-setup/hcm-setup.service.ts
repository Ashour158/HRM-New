import { Inject, Injectable, Optional } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { DEFAULT_HCM_SETUP } from './hcm-setup.defaults.js';
import { HcmSetupRepository } from './hcm-setup.repository.js';
import type { HcmSetupConfig, HcmSetupUpdate } from './hcm-setup.types.js';

export interface HcmSetupStore {
  getByTenant(tenantId: Uuid): Promise<HcmSetupConfig | undefined>;
  upsert(tenantId: Uuid, config: HcmSetupConfig): Promise<void>;
}

function cloneSetup(setup: HcmSetupConfig): HcmSetupConfig {
  return JSON.parse(JSON.stringify(setup)) as HcmSetupConfig;
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
