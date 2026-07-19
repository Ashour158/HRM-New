import type { HcmSetupConfig, PayrollGlAccountMapping } from '../../hcm-setup/hcm-setup.types.js';
import type { PayrollCyclePreview } from './payroll-cycle-calculation.service.js';

/**
 * Resolves the GL account mapping for a payroll cycle preview, preferring a work-location
 * scoped statutory pack over a country-scoped one. Pure function so it can be shared between
 * the request-driven controller endpoints and the background close-to-pay job.
 */
export function resolvePayrollGlAccountMapping(
  setup: HcmSetupConfig,
  preview: PayrollCyclePreview,
  workLocationCode?: string,
): PayrollGlAccountMapping | undefined {
  const locationCodes = new Set([
    workLocationCode,
    ...preview.rows.map((row) => row.workLocationCode),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0));
  const countryCodes = new Set(setup.locations
    .filter((location) => locationCodes.size === 0 || locationCodes.has(location.code))
    .map((location) => location.countryCode)
    .filter((value): value is string => typeof value === 'string' && value.length > 0));
  const activePacks = (setup.statutoryPayrollPacks ?? []).filter((pack) => pack.active);
  const locationPack = activePacks.find((pack) => (pack.locationCodes ?? []).some((code) => locationCodes.has(code)));
  if (locationPack?.glAccountMapping) return locationPack.glAccountMapping;
  const countryPack = activePacks.find((pack) => countryCodes.size === 0 || countryCodes.has(pack.countryCode));
  return countryPack?.glAccountMapping;
}
