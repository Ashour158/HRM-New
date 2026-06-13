import { describe, it, expect } from 'vitest';
import { schedulerPeriodKey, isCronDue } from './scheduler-time.js';
import type { TenantTimezone } from '../../domains/hcm-setup/hcm-setup-currency.js';

// 2026-06-13T23:30:00Z. With a +03:00 offset, tenant-local time is 2026-06-14 02:30.
const instant = new Date('2026-06-13T23:30:00.000Z');

describe('scheduler-time offset-style timezones', () => {
  it('does not throw and applies the offset for "UTC+03:00" string labels', () => {
    // Regression: offset-style strings are not valid IANA zones and made Intl throw,
    // failing every timezone-dependent scheduler job.
    expect(() => schedulerPeriodKey(instant, 'UTC+03:00')).not.toThrow();
    expect(schedulerPeriodKey(instant, 'UTC+03:00')).toBe('20260614T02:30@UTC+03:00');
  });

  it('matches the offset-string result to the equivalent TenantTimezone object', () => {
    const tz: TenantTimezone = { offsetMinutes: 180, label: 'UTC+03:00' };
    expect(schedulerPeriodKey(instant, tz)).toBe('20260614T02:30@UTC+03:00');
  });

  it.each(['UTC', 'GMT-5', '+0530', '-08:00'])('parses offset form %s without throwing', (tz) => {
    expect(() => schedulerPeriodKey(instant, tz)).not.toThrow();
  });

  it('still resolves a real IANA zone via Intl', () => {
    expect(() => schedulerPeriodKey(instant, 'Asia/Riyadh')).not.toThrow();
  });

  it('evaluates cron against tenant-local time for an offset string', () => {
    // 02:30 local -> minute 30, hour 2.
    expect(isCronDue('30 2 * * *', instant, 'UTC+03:00')).toBe(true);
    expect(isCronDue('30 5 * * *', instant, 'UTC+03:00')).toBe(false);
  });
});
