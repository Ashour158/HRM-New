import { describe, expect, it } from 'vitest';
import { AttendanceTrustService } from './attendance-trust.service.js';
import type { AttendancePolicy } from './attendance-calculation.service.js';

const policy: AttendancePolicy = {
  standardDailyMinutes: 480,
  flexibleHoursEnabled: true,
  lateGraceMinutes: 10,
  overtimeAfterMinutes: 480,
  geofenceEnabled: true,
  allowedRadiusMeters: 250,
  geofenceProfiles: [
    {
      code: 'CAIRO_STRICT',
      label: 'Cairo strict geofence',
      active: true,
      locationCode: 'CAIRO_HQ',
      radiusMeters: 120,
      highAccuracyRequiredMeters: 50,
      requireGeolocation: true,
    },
  ],
  deviceTrustRules: [
    { code: 'BROWSER', label: 'Browser devices', active: true, deviceIdPattern: 'browser-*', trustLevel: 'TRUSTED' },
    { code: 'KIOSK_BLOCK', label: 'Blocked kiosk', active: true, deviceIdPattern: 'blocked-kiosk', trustLevel: 'BLOCKED', requiresApproval: true },
  ],
  minClockTrustScore: 70,
};

const locations = [
  {
    code: 'CAIRO_HQ',
    label: 'Cairo HQ',
    active: true,
    countryCode: 'EG',
    countryName: 'Egypt',
    flag: 'EG',
    city: 'Cairo',
    currency: 'EGP',
    latitude: 30.0444,
    longitude: 31.2357,
  },
];

describe('AttendanceTrustService', () => {
  const service = new AttendanceTrustService();

  it('scores a trusted device inside a workplace geofence as high trust', () => {
    const result = service.evaluateClockEvidence({
      policy,
      locations,
      workplaceCode: 'CAIRO_HQ',
      latitude: 30.0444,
      longitude: 31.2357,
      accuracyMeters: 20,
      deviceId: 'browser-ahmed',
    });

    expect(result.locationStatus).toBe('INSIDE_GEOFENCE');
    expect(result.deviceTrustLevel).toBe('TRUSTED');
    expect(result.trustLevel).toBe('HIGH');
    expect(result.requiresApproval).toBe(false);
  });

  it('flags outside geofence and blocked device evidence for approval', () => {
    const result = service.evaluateClockEvidence({
      policy,
      locations,
      workplaceCode: 'CAIRO_HQ',
      latitude: 30.06,
      longitude: 31.28,
      accuracyMeters: 150,
      deviceId: 'blocked-kiosk',
    });

    expect(result.locationStatus).toBe('OUTSIDE_GEOFENCE');
    expect(result.deviceTrustLevel).toBe('BLOCKED');
    expect(result.trustLevel).toBe('LOW');
    expect(result.requiresApproval).toBe(true);
    expect(result.reasons).toEqual(expect.arrayContaining(['OUTSIDE_GEOFENCE', 'LOW_ACCURACY', 'BLOCKED_DEVICE']));
  });
});
