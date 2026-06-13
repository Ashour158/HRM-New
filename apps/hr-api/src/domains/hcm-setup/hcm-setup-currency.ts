import type { HcmSetupConfig } from './hcm-setup.types.js';

function firstNonBlank(values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
}

export interface TenantTimezone {
  timeZone?: string;
  offsetMinutes?: number;
  label: string;
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

export function resolveTenantTimezone(setup: HcmSetupConfig): TenantTimezone {
  const locations = setup.locations ?? [];
  const cities = setup.cities ?? [];
  const timeZone = firstNonBlank([
    setup.timezone,
    setup.attendancePolicy?.timezone,
    locations.find((location) => location.active)?.timezone,
    locations.find((location) => location.timezone)?.timezone,
    cities.find((city) => city.active)?.timezone,
    cities.find((city) => city.timezone)?.timezone,
  ]);
  const offsetMinutes = finiteNumber(setup.attendancePolicy?.timezoneOffsetMinutes);

  if (timeZone) {
    assertValidTimeZone(timeZone);
    return { timeZone, offsetMinutes, label: timeZone };
  }

  if (offsetMinutes !== undefined) {
    return {
      timeZone: undefined,
      offsetMinutes,
      label: formatOffsetLabel(offsetMinutes),
    };
  }

  throw new Error('Tenant timezone is not configured in HCM setup');
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
  } catch {
    throw new Error(`Tenant timezone ${timeZone} is not a valid IANA timezone`);
  }
}

function formatOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60).toString().padStart(2, '0');
  const minutes = (absolute % 60).toString().padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}
