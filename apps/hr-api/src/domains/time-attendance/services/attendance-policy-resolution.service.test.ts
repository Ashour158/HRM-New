import { describe, expect, it } from 'vitest';
import { AttendancePolicyResolutionService } from './attendance-policy-resolution.service.js';
import type { HcmSetupConfig } from '../../hcm-setup/hcm-setup.types.js';

const setup = {
  locations: [
    { code: 'CAIRO_HQ', label: 'Cairo HQ', active: true, countryCode: 'EG', countryName: 'Egypt', flag: 'EG', city: 'Cairo', currency: 'EGP' },
    { code: 'NY_REMOTE', label: 'New York Remote', active: true, countryCode: 'US', countryName: 'United States', flag: 'US', city: 'New York', currency: 'USD' },
  ],
  attendancePolicy: {
    standardDailyMinutes: 480,
    flexibleHoursEnabled: true,
    flexibleWindowStart: '07:00',
    flexibleWindowEnd: '10:00',
    coreStartTime: '10:00',
    coreEndTime: '15:00',
    standardStartTime: '09:00',
    standardEndTime: '17:00',
    lateGraceMinutes: 10,
    overtimeAfterMinutes: 480,
    geofenceEnabled: true,
    allowedRadiusMeters: 250,
    workDays: [0, 1, 2, 3, 4],
    holidayCalendars: [
      { date: '2026-07-04', name: 'Independence Day', countryCode: 'US' },
      { date: '2026-07-04', name: 'Cairo Plant Maintenance', locationCodes: ['CAIRO_HQ'] },
    ],
    shiftRotations: [
      {
        code: 'OPS_4_DAY',
        label: 'Operations 4-day cycle',
        active: true,
        anchorDate: '2026-05-25',
        cycleDays: 4,
        workDayOffsets: [0, 1],
        dailyMinutes: 720,
        startTime: '07:00',
        endTime: '19:00',
        locationCodes: ['CAIRO_HQ'],
      },
    ],
    flexibleHoursRules: [
      {
        code: 'CAIRO_CORE',
        label: 'Cairo core hours',
        active: true,
        locationCodes: ['CAIRO_HQ'],
        flexibleWindowStart: '06:30',
        flexibleWindowEnd: '09:30',
        coreStartTime: '09:30',
        coreEndTime: '14:30',
        minimumPayableDayMinutes: 360,
      },
    ],
  },
} as unknown as HcmSetupConfig;

describe('AttendancePolicyResolutionService', () => {
  const service = new AttendancePolicyResolutionService();

  it('resolves location and country scoped holidays independently', () => {
    const cairo = service.resolveWorkerDay({
      setup,
      workDate: '2026-07-04',
      worker: { workerId: 'worker-eg', workplaceCode: 'CAIRO_HQ' },
    });
    const newYork = service.resolveWorkerDay({
      setup,
      workDate: '2026-07-04',
      worker: { workerId: 'worker-us', workplaceCode: 'NY_REMOTE' },
    });

    expect(cairo.holiday?.name).toBe('Cairo Plant Maintenance');
    expect(newYork.holiday?.name).toBe('Independence Day');
  });

  it('applies targeted shift rotations by cycle offset', () => {
    const workDay = service.resolveWorkerDay({
      setup,
      workDate: '2026-05-26',
      worker: { workerId: 'worker-eg', workplaceCode: 'CAIRO_HQ' },
    });
    const restDay = service.resolveWorkerDay({
      setup,
      workDate: '2026-05-27',
      worker: { workerId: 'worker-eg', workplaceCode: 'CAIRO_HQ' },
    });

    expect(workDay.scheduled).toBe(true);
    expect(workDay.scheduledDailyMinutes).toBe(720);
    expect(workDay.shiftCode).toBe('OPS_4_DAY');
    expect(restDay.scheduled).toBe(false);
  });

  it('merges flexible-hour rules into the effective policy for matching employees', () => {
    const resolved = service.resolveWorkerDay({
      setup,
      workDate: '2026-05-25',
      worker: { workerId: 'worker-eg', workplaceCode: 'CAIRO_HQ' },
    });

    expect(resolved.effectivePolicy.flexibleWindowStart).toBe('06:30');
    expect(resolved.effectivePolicy.coreStartTime).toBe('09:30');
    expect(resolved.effectivePolicy.minimumPayableDayMinutes).toBe(360);
  });
});
