import { describe, expect, it } from 'vitest';
import { DEFAULT_HCM_SETUP } from '../../hcm-setup/hcm-setup.defaults.js';
import { LeavePolicyService } from './leave-policy.service.js';

describe('LeavePolicyService', () => {
  const service = new LeavePolicyService();

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
