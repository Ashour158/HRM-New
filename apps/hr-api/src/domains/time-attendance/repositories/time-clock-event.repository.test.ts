import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { TimeClockEvent } from '../aggregates/time-clock-event.aggregate.js';
import { TimeClockEventRepository } from './time-clock-event.repository.js';

describe('TimeClockEventRepository JSON evidence mapping', () => {
  const repo = Object.create(TimeClockEventRepository.prototype) as {
    toRow(entity: TimeClockEvent): Record<string, unknown>;
    toAggregate(row: Record<string, unknown>): TimeClockEvent;
  };

  it('serializes jsonb evidence fields as JSON strings for Postgres writes', () => {
    const event = new TimeClockEvent({
      id: new Uuid('00000000-0000-0000-0000-000000000901'),
      tenantId: new Uuid('00000000-0000-0000-0000-000000000001'),
      workerId: new Uuid('00000000-0000-0000-0000-000000000012'),
      eventType: 'CLOCK_IN',
      timestamp: new Date('2026-06-02T08:00:00.000Z'),
      trustReasons: ['LOW_ACCURACY', 'STANDARD_DEVICE'],
      captureEvidence: {
        geolocation: { workplaceCode: 'CAIRO_HQ', distanceMeters: 15 },
        trust: { trustScore: 75, requiresApproval: false },
      },
    });

    const row = repo.toRow(event);

    expect(row.trust_reasons).toBe('["LOW_ACCURACY","STANDARD_DEVICE"]');
    expect(row.capture_evidence).toBe(JSON.stringify({
      geolocation: { workplaceCode: 'CAIRO_HQ', distanceMeters: 15 },
      trust: { trustScore: 75, requiresApproval: false },
    }));
  });

  it('hydrates jsonb evidence whether Postgres returns objects or strings', () => {
    const hydrated = repo.toAggregate({
      id: '00000000-0000-0000-0000-000000000901',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      worker_id: '00000000-0000-0000-0000-000000000012',
      event_type: 'CLOCK_IN',
      timestamp: new Date('2026-06-02T08:00:00.000Z'),
      location: null,
      latitude: null,
      longitude: null,
      accuracy_meters: null,
      workplace_code: null,
      distance_meters: null,
      geofence_radius_meters: null,
      geofence_profile_code: null,
      location_status: null,
      device_trust_level: null,
      trust_level: null,
      trust_score: null,
      trust_requires_approval: null,
      trust_reasons: '["LOW_ACCURACY"]',
      device_id: null,
      capture_method: null,
      capture_device_kind: null,
      capture_reference: null,
      verification_status: null,
      capture_evidence: '{"trust":{"trustScore":75}}',
      status: 'RECORDED',
      aggregate_version: 0,
      created_at: new Date('2026-06-02T08:00:00.000Z'),
      updated_at: new Date('2026-06-02T08:00:00.000Z'),
    });

    expect(hydrated.trustReasons).toEqual(['LOW_ACCURACY']);
    expect(hydrated.captureEvidence).toEqual({ trust: { trustScore: 75 } });
  });
});
