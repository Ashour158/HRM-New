import { describe, expect, it } from 'vitest';
import { PayrollStatutoryPolicyService } from './payroll-statutory-policy.service.js';
import type { HcmSetupConfig } from '../../hcm-setup/hcm-setup.types.js';
import type { PayrollCycleEmployeeInput } from './payroll-cycle-calculation.service.js';

const setup = {
  payrollCalculationPolicy: {
    taxMode: 'FLAT_PERCENT',
    taxRatePercent: 10,
    employeeInsuranceRatePercent: 5,
    employerInsuranceRatePercent: 10,
  },
  locations: [
    { code: 'CAIRO_HQ', label: 'Cairo HQ', active: true, countryCode: 'EG', countryName: 'Egypt', flag: 'EG', city: 'Cairo', currency: 'EGP' },
  ],
  statutoryPayrollPacks: [
    {
      code: 'EG_2026',
      label: 'Egypt statutory payroll 2026',
      active: true,
      countryCode: 'EG',
      locationCodes: ['CAIRO_HQ'],
      employeeTypes: ['FULL_TIME'],
      currency: 'EGP',
      calculationPolicy: {
        taxMode: 'PROGRESSIVE_BRACKETS',
        taxRatePercent: 0,
        taxBrackets: [
          { code: 'EG-TAX-1', thresholdFrom: 0, thresholdTo: 5000, ratePercent: 0 },
          { code: 'EG-TAX-2', thresholdFrom: 5000, ratePercent: 20 },
        ],
        employeeInsuranceRatePercent: 7,
        employerInsuranceRatePercent: 12,
        employeeInsuranceCap: 1200,
        employerInsuranceCap: 2000,
      },
    },
  ],
} as HcmSetupConfig;

const employee: PayrollCycleEmployeeInput = {
  workerId: 'worker-1',
  employeeId: 'EMP-001',
  name: 'Mona Hassan',
  email: 'mona@example.com',
  workLocationCode: 'CAIRO_HQ',
  employmentType: 'FULL_TIME',
  grossSalary: 10000,
  currency: 'EGP',
};

describe('PayrollStatutoryPolicyService', () => {
  const service = new PayrollStatutoryPolicyService();

  it('resolves country and location statutory packs before falling back to tenant default policy', () => {
    const resolved = service.resolveCalculationPolicy(setup, employee);

    expect(resolved.pack?.code).toBe('EG_2026');
    expect(resolved.policy.taxMode).toBe('PROGRESSIVE_BRACKETS');
    expect(resolved.policy.employeeInsuranceRatePercent).toBe(7);

    const fallback = service.resolveCalculationPolicy(setup, {
      ...employee,
      workLocationCode: 'US_REMOTE',
      employmentType: 'CONTRACTOR',
      currency: 'USD',
    });
    expect(fallback.pack).toBeUndefined();
    expect(fallback.policy.taxRatePercent).toBe(10);
  });
});
