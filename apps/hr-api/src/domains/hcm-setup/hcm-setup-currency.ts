import type { HcmSetupConfig } from './hcm-setup.types.js';

function firstNonBlank(values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
}

export function resolveTenantCurrency(setup: HcmSetupConfig): string {
  const locations = setup.locations ?? [];
  const cities = setup.cities ?? [];
  const statutoryPayrollPacks = setup.statutoryPayrollPacks ?? [];
  const salaryCompositionPlans = setup.salaryCompositionPlans ?? [];
  const currency = firstNonBlank([
    locations.find((location) => location.active)?.currency,
    locations.find((location) => location.currency)?.currency,
    cities.find((city) => city.active)?.currency,
    cities.find((city) => city.currency)?.currency,
    statutoryPayrollPacks.find((pack) => pack.active)?.currency,
    statutoryPayrollPacks.find((pack) => pack.currency)?.currency,
    salaryCompositionPlans.find((plan) => plan.active)?.currency,
    salaryCompositionPlans.find((plan) => plan.currency)?.currency,
  ]);

  if (!currency) {
    throw new Error('Tenant currency is not configured in HCM setup');
  }

  return currency;
}
