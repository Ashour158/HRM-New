import { Injectable } from '@nestjs/common';
import type { TimeClockEvent } from '../aggregates/time-clock-event.aggregate.js';

export interface AttendanceGeolocationExportWorker {
  workerId: string;
  employeeId: string;
  name: string;
  email: string;
  departmentName?: string;
  workLocationCode?: string;
}

interface ClockLocationEvidence {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  workplaceCode?: string;
  distanceMeters?: number;
  geofenceRadiusMeters?: number;
  geofenceProfileCode?: string;
  locationStatus?: string;
  deviceTrustLevel?: string;
  trustLevel?: string;
  trustScore?: number;
  trustRequiresApproval?: boolean;
  trustReasons?: string[];
}

export interface AttendanceGeolocationExportInput {
  workDate: string;
  timezoneOffsetMinutes?: number;
  workers: AttendanceGeolocationExportWorker[];
  events: TimeClockEvent[];
}

const HEADERS = [
  'employeeId',
  'name',
  'email',
  'department',
  'workDate',
  'eventId',
  'eventType',
  'timestamp',
  'recordStatus',
  'workplaceCode',
  'latitude',
  'longitude',
  'accuracyMeters',
  'distanceMeters',
  'geofenceRadiusMeters',
  'geofenceProfileCode',
  'locationStatus',
  'deviceId',
  'deviceTrustLevel',
  'trustLevel',
  'trustScore',
  'trustRequiresApproval',
  'trustReasons',
  'locationDataClassification',
  'visibilityScope',
];

function parseLocation(value?: string): ClockLocationEvidence {
  if (!value) return {};
  try {
    return JSON.parse(value) as ClockLocationEvidence;
  } catch {
    return {};
  }
}

function localDateKey(date: Date, timezoneOffsetMinutes: number): string {
  return new Date(date.getTime() + timezoneOffsetMinutes * 60000).toISOString().slice(0, 10);
}

function csvCell(value: unknown): string {
  const raw = Array.isArray(value) ? value.join('|') : value ?? '';
  let text = String(raw);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

@Injectable()
export class AttendanceGeolocationExportService {
  buildCsv(input: AttendanceGeolocationExportInput): string {
    const timezoneOffsetMinutes = input.timezoneOffsetMinutes ?? 0;
    const workersById = new Map(input.workers.map((worker) => [worker.workerId, worker]));
    const rows = input.events
      .filter((event) => localDateKey(event.timestamp, timezoneOffsetMinutes) === input.workDate)
      .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime())
      .map((event) => {
        const worker = workersById.get(event.workerId.value);
        const location = parseLocation(event.location);
        return [
          worker?.employeeId ?? '',
          worker?.name ?? '',
          worker?.email ?? '',
          worker?.departmentName ?? '',
          input.workDate,
          event.id.value,
          event.eventType,
          event.timestamp.toISOString(),
          event.status,
          location.workplaceCode ?? worker?.workLocationCode ?? '',
          location.latitude,
          location.longitude,
          location.accuracyMeters,
          location.distanceMeters,
          location.geofenceRadiusMeters,
          location.geofenceProfileCode,
          location.locationStatus,
          event.deviceId,
          location.deviceTrustLevel,
          location.trustLevel,
          location.trustScore,
          location.trustRequiresApproval,
          location.trustReasons,
          'CONFIDENTIAL',
          'HR_PAYROLL_ADMIN_ONLY',
        ];
      });

    return [HEADERS, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\n');
  }
}
