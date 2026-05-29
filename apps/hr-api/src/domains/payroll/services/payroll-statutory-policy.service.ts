import { Injectable } from '@nestjs/common';
import type { HcmSetupConfig, PayrollCalculationPolicy, StatutoryPayrollPack } from '../../hcm-setup/hcm-setup.types.js';
import type { PayrollCycleEmployeeInput } from './payroll-cycle-calculation.service.js';

function matches(values: string[] | undefined, candidate: string | undefined): boolean {
  return !values?.length || Boolean(candidate && values.includes(candidate));
}

function overlaps(effectiveFrom: string | undefined, effectiveUntil: string | undefined, date = new Date()): boolean {
  const today = date.toISOString().slice(0, 10);
  if (effectiveFrom && effectiveFrom > today) return false;
  if (effectiveUntil && effectiveUntil < today) return false;
  return true;
}

@Injectable()
export class PayrollStatutoryPolicyService {
  resolveCalculationPolicy(
    setup: HcmSetupConfig,
    employee: PayrollCycleEmployeeInput,
    date = new Date(),
  ): { policy: PayrollCalculationPolicy; pack?: StatutoryPayrollPack } {
    const location = (setup.locations ?? []).find((item) => item.code === employee.workLocationCode);
    const countryCode = location?.countryCode;
    const employeeType = employee.employmentType ?? employee.salaryBasis;
    const pack = (setup.statutoryPayrollPacks ?? [])
      .filter((item) => item.active)
      .filter((item) => !countryCode || item.countryCode === countryCode)
      .filter((item) => matches(item.locationCodes, employee.workLocationCode))
      .filter((item) => matches(item.employeeTypes, employeeType))
      .filter((item) => overlaps(item.effectiveFrom, item.effectiveUntil, date))
      .sort((left, right) => {
        const leftSpecificity = (left.locationCodes?.length ? 2 : 0) + (left.employeeTypes?.length ? 1 : 0);
        const rightSpecificity = (right.locationCodes?.length ? 2 : 0) + (right.employeeTypes?.length ? 1 : 0);
        return rightSpecificity - leftSpecificity;
      })[0];

    return {
      policy: pack?.calculationPolicy ?? setup.payrollCalculationPolicy,
      pack,
    };
  }
}
