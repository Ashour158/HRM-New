import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { TimeClockEvent } from '../aggregates/time-clock-event.aggregate.js';
import { AttendanceGeolocationExportService } from './attendance-geolocation-export.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('11111111-1111-1111-1111-111111111111');

function event(location: Record<string, unknown>) {
  return new TimeClockEvent({
    id: new Uuid('22222222-2222-2222-2222-222222222222'),
    tenantId,
    workerId,
    eventType: 'CLOCK_IN',
    timestamp: new Date('2026-05-25T06:30:00.000Z'),
    location: JSON.stringify(location),
    deviceId: '=browser',
    status: 'VALIDATED',
  });
}

describe('AttendanceGeolocationExportService', () => {
  const service = new AttendanceGeolocationExportService();

  it('exports timestamped geolocation evidence with governance metadata', () => {
    const csv = service.buildCsv({
      workDate: '2026-05-25',
      timezoneOffsetMinutes: 180,
      workers: [
        {
          workerId: workerId.value,
          employeeId: 'EMP-007',
          name: 'Ahmed Ashour',
          email: 'ahmed@example.com',
          departmentName: 'Engineering',
          workLocationCode: 'CAIRO_HQ',
        },
      ],
      events: [
        event({
          latitude: 30.0444,
          longitude: 31.2357,
          accuracyMeters: 12,
          workplaceCode: 'CAIRO_HQ',
          distanceMeters: 8,
          geofenceRadiusMeters: 120,
          geofenceProfileCode: 'CAIRO_STRICT',
          locationStatus: 'INSIDE_GEOFENCE',
          deviceTrustLevel: 'TRUSTED',
          trustLevel: 'HIGH',
          trustScore: 100,
          trustRequiresApproval: false,
          trustReasons: ['OK'],
        }),
      ],
    });

    expect(csv).toContain('locationDataClassification');
    expect(csv).toContain('"EMP-007","Ahmed Ashour","ahmed@example.com","Engineering","2026-05-25"');
    expect(csv).toContain('"30.0444","31.2357","12","8","120","CAIRO_STRICT","INSIDE_GEOFENCE"');
    expect(csv).toContain('"\'=browser"');
    expect(csv).toContain('"CONFIDENTIAL","HR_PAYROLL_ADMIN_ONLY"');
  });
});
