import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { HcmSetupService } from './hcm-setup.service.js';

describe('HcmSetupService', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');

  it('returns seeded low-code defaults when no tenant setup exists', async () => {
    const repository = {
      getByTenant: vi.fn().mockResolvedValue(undefined),
      upsert: vi.fn(),
    };
    const service = new HcmSetupService(repository);

    const setup = await service.getSetup(tenantId);

    expect(setup.employeeIdPolicy.mode).toBe('MANUAL_ONLY');
    expect(setup.genderOptions.map((option) => option.value)).toContain('FEMALE');
    expect(setup.locations[0]).toEqual(expect.objectContaining({ countryCode: 'EG', currency: 'EGP' }));
    expect(setup.payrollCalculationPolicy).toEqual(
      expect.objectContaining({ taxRatePercent: 15, employeeInsuranceRatePercent: 7 }),
    );
    expect(setup.fieldRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldKey: 'firstName', required: true }),
        expect.objectContaining({ fieldKey: 'workEmail', required: true }),
        expect.objectContaining({ fieldKey: 'bankAccount', required: false }),
      ]),
    );
    expect(setup.documentRequirements).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'NATIONAL_ID', required: true })]),
    );
    expect(setup.leavePolicies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'VACATION', unit: 'DAYS', requestableByEmployee: true }),
        expect.objectContaining({ code: 'PERMISSION', unit: 'HOURS', requestableByEmployee: true }),
        expect.objectContaining({ code: 'PUBLIC_HOLIDAY', systemManaged: true, requestableByEmployee: false }),
      ]),
    );
  });

  it('merges admin updates with defaults and persists the resulting setup', async () => {
    const repository = {
      getByTenant: vi.fn().mockResolvedValue(undefined),
      upsert: vi.fn().mockResolvedValue(undefined),
    };
    const service = new HcmSetupService(repository);

    const setup = await service.updateSetup(tenantId, {
      employeeIdPolicy: { mode: 'AUTO', prefix: 'EG-HR', nextNumber: 42 },
      payrollCalculationPolicy: { taxRatePercent: 20, employeeInsuranceRatePercent: 8 },
      jobTitles: [{ code: 'HRBP', label: 'HR Business Partner', active: true }],
    });

    expect(setup.employeeIdPolicy).toEqual({ mode: 'AUTO', prefix: 'EG-HR', nextNumber: 42 });
    expect(setup.payrollCalculationPolicy).toEqual(
      expect.objectContaining({ taxRatePercent: 20, employeeInsuranceRatePercent: 8 }),
    );
    expect(setup.jobTitles).toEqual([{ code: 'HRBP', label: 'HR Business Partner', active: true }]);
    expect(setup.locations.length).toBeGreaterThan(0);
    expect(repository.upsert).toHaveBeenCalledWith(tenantId, setup);
  });
});
