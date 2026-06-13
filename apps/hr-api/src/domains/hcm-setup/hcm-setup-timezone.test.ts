import { describe, expect, it } from 'vitest';
import type { HcmSetupConfig } from './hcm-setup.types.js';
import { resolveTenantTimezone } from './hcm-setup-currency.js';

describe('resolveTenantTimezone', () => {
  it('prefers an explicit tenant IANA timezone from HCM setup', () => {
    const setup = {
      timezone: 'Africa/Cairo',
      attendancePolicy: { timezoneOffsetMinutes: 180 },
    } as HcmSetupConfig & { timezone?: string };

    expect(resolveTenantTimezone(setup)).toEqual({
      timeZone: 'Africa/Cairo',
      offsetMinutes: 180,
      label: 'Africa/Cairo',
    });
  });

  it('falls back to attendance timezone offset without using server local time', () => {
    const setup = {
      attendancePolicy: { timezoneOffsetMinutes: 330 },
    } as HcmSetupConfig;

    expect(resolveTenantTimezone(setup)).toEqual({
      timeZone: undefined,
      offsetMinutes: 330,
      label: 'UTC+05:30',
    });
  });

  it('fails fast when no tenant timezone signal is configured', () => {
    expect(() => resolveTenantTimezone({ attendancePolicy: {} } as HcmSetupConfig)).toThrow(
      'Tenant timezone is not configured in HCM setup',
    );
  });
});
