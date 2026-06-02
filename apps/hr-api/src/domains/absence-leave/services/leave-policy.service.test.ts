import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HCM_SETUP } from '../../hcm-setup/hcm-setup.defaults.js';
import { LeavePolicyService } from './leave-policy.service.js';

describe('LeavePolicyService', () => {
  const service = new LeavePolicyService();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates day-based leave in working days and excludes configured holidays', () => {
    const setup = {
      ...DEFAULT_HCM_SETUP,
      attendancePolicy: {
        ...DEFAULT_HCM_SETUP.attendancePolicy,
        workDays: [1, 2, 3, 4, 5],
        holidayCalendars: [{ date: '2026-06-03', name: 'Company holiday', countryCode: 'EG' }],
      },
    };

    const result = service.calculateDuration(setup, {
      absenceType: 'VACATION',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-05T00:00:00.000Z'),
      countryCode: 'EG',
    });

    expect(result.durationUnit).toBe('DAYS');
    expect(result.durationAmount).toBe(4);
    expect(result.calendarDays).toBe(5);
    expect(result.excludedHolidayDates).toEqual(['2026-06-03']);
  });

  it('rejects day-based leave that exceeds the configured per-request policy limit', () => {
    expect(() => service.calculateDuration(DEFAULT_HCM_SETUP, {
      absenceType: 'VACATION',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-22T00:00:00.000Z'),
    })).toThrow(/exceeds max per request of 15 days/);
  });

  it('rejects employee-requestable leave that does not satisfy minimum notice', () => {
    vi.setSystemTime(new Date('2026-06-03T08:00:00.000Z'));

    expect(() => service.calculateDuration(DEFAULT_HCM_SETUP, {
      absenceType: 'VACATION',
      startDate: new Date('2026-06-04T00:00:00.000Z'),
      endDate: new Date('2026-06-05T00:00:00.000Z'),
    })).toThrow(/requires at least 2 days notice/);
  });

  it('rejects holiday-only day-based leave because the calculated working duration is zero', () => {
    const setup = {
      ...DEFAULT_HCM_SETUP,
      attendancePolicy: {
        ...DEFAULT_HCM_SETUP.attendancePolicy,
        workDays: [1, 2, 3, 4, 5],
        holidayCalendars: [{ date: '2026-06-03', name: 'Company holiday', countryCode: 'EG' }],
      },
    };

    expect(() => service.calculateDuration(setup, {
      absenceType: 'VACATION',
      startDate: new Date('2026-06-03T00:00:00.000Z'),
      endDate: new Date('2026-06-03T00:00:00.000Z'),
      countryCode: 'EG',
    })).toThrow(/does not include any scheduled working day/);
  });

  it('rejects requests that exceed the available annual entitlement balance', () => {
    const setup = {
      ...DEFAULT_HCM_SETUP,
      leavePolicies: DEFAULT_HCM_SETUP.leavePolicies.map((policy) => (
        policy.code === 'VACATION'
          ? { ...policy, annualEntitlement: 1, maxPerRequest: 5 }
          : policy
      )),
    };

    const result = service.calculateDuration(setup, {
      absenceType: 'VACATION',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-02T00:00:00.000Z'),
    });

    expect(result.durationAmount).toBe(2);
    const policyResult = service.checkBalance(setup, result);
    expect(policyResult.allowed).toBe(false);
    expect(policyResult.reason).toContain('available balance');
    expect(() => service.assertBalanceAvailable(setup, result)).toThrow(/available balance/);
  });

  it('calculates permission by hours only', () => {
    const result = service.calculateDuration(DEFAULT_HCM_SETUP, {
      absenceType: 'PERMISSION',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-01T00:00:00.000Z'),
      startTime: '09:00',
      endTime: '11:30',
    });

    expect(result.durationUnit).toBe('HOURS');
    expect(result.durationAmount).toBe(2.5);
    expect(result.payrollImpact).toBe('PERMISSION');
  });

  it('rejects hourly permission that exceeds the configured per-request policy limit', () => {
    expect(() => service.calculateDuration(DEFAULT_HCM_SETUP, {
      absenceType: 'PERMISSION',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-01T00:00:00.000Z'),
      startTime: '09:00',
      endTime: '14:00',
    })).toThrow(/exceeds max per request of 4 hours/);
  });

  it('rejects hourly leave without time range', () => {
    expect(() => service.calculateDuration(DEFAULT_HCM_SETUP, {
      absenceType: 'PERMISSION',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-01T00:00:00.000Z'),
    })).toThrow(/requires start and end time/);
  });

  it('converts stored balance hours to policy units', () => {
    const vacation = service.resolvePolicy(DEFAULT_HCM_SETUP, 'VACATION');
    const permission = service.resolvePolicy(DEFAULT_HCM_SETUP, 'PERMISSION');

    expect(service.amountFromStoredHours(DEFAULT_HCM_SETUP, vacation, 120)).toBe(15);
    expect(service.amountFromStoredHours(DEFAULT_HCM_SETUP, permission, 3.5)).toBe(3.5);
  });
});
