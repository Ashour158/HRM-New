import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { DEFAULT_HCM_SETUP } from '../../hcm-setup/hcm-setup.defaults.js';
import { AttendanceTrustService } from '../services/attendance-trust.service.js';
import { RecordTimeClockEventHandler } from './record-time-clock-event.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000201');

function command(payload: Record<string, unknown>): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'RecordTimeClockEvent',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: workerId,
      roles: ['EMPLOYEE'],
      permissions: [],
      mfaAuthenticated: true,
    },
    aggregateType: 'TimeClockEvent',
    idempotencyKey: 'record-time-clock-event-test',
    correlationId: Uuid.generate(),
    reason: 'test',
    payload,
    metadata: { requestHash: 'hash', clientType: 'EMPLOYEE_PORTAL' },
  };
}

describe('RecordTimeClockEventHandler policy enforcement', () => {
  it('rejects mobile geofence punches when the applied attendance policy requires geolocation', async () => {
    const handler = new RecordTimeClockEventHandler(
      { save: vi.fn() } as never,
      { getAllowedActionsFromState: vi.fn().mockReturnValue([]) } as never,
      { publishFromAggregate: vi.fn() } as never,
      { getSetup: vi.fn().mockResolvedValue(DEFAULT_HCM_SETUP) } as never,
      new AttendanceTrustService(),
    );

    await expect(handler.handle(command({
      workerId,
      eventType: 'CLOCK_IN',
      timestamp: new Date('2026-06-03T06:00:00.000Z'),
      workplaceCode: 'CAIRO_HQ',
      captureMethod: 'MOBILE_GEOFENCE',
      deviceId: 'browser-demo',
    }))).rejects.toThrow(/Geolocation evidence is required/);
  });

  it('stores computed trust evidence from the applied attendance policy', async () => {
    const save = vi.fn();
    const handler = new RecordTimeClockEventHandler(
      { save } as never,
      { getAllowedActionsFromState: vi.fn().mockReturnValue([]) } as never,
      { publishFromAggregate: vi.fn() } as never,
      { getSetup: vi.fn().mockResolvedValue(DEFAULT_HCM_SETUP) } as never,
      new AttendanceTrustService(),
    );

    const result = await handler.handle(command({
      workerId,
      eventType: 'CLOCK_IN',
      timestamp: new Date('2026-06-03T06:00:00.000Z'),
      workplaceCode: 'CAIRO_HQ',
      latitude: 30.0444,
      longitude: 31.2357,
      accuracyMeters: 25,
      captureMethod: 'MOBILE_GEOFENCE',
      deviceId: 'browser-demo',
    }));

    expect(result.data).toMatchObject({
      workerId: workerId.value,
      eventType: 'CLOCK_IN',
      locationStatus: 'INSIDE_GEOFENCE',
      trustRequiresApproval: false,
    });
    expect(save.mock.calls[0]?.[0].captureEvidence).toMatchObject({
      policyEvidence: {
        engine: 'AttendanceTrustService',
        decision: 'ACCEPTED',
      },
    });
  });
});
