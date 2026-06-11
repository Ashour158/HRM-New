import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { BenefitsCarrierConsumer } from './benefits-carrier.consumer.js';

const BENEFITS_ENROLLMENT_EFFECTIVE = 'BenefitsEnrollmentEffective';
const LIFE_EVENT_PROCESSED = 'LifeEventProcessed';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const eventId = new Uuid('00000000-0000-0000-0000-000000000002');
const aggregateId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');
const enrollmentId = '00000000-0000-0000-0000-000000000101';
const workerId = '00000000-0000-0000-0000-000000000102';
const programId = '00000000-0000-0000-0000-000000000103';
const lifeEventId = '00000000-0000-0000-0000-000000000201';

function buildConsumer() {
  const carrierAdapter = {
    sendEnrollment: vi.fn().mockResolvedValue({ success: true }),
    sendLifeEventUpdate: vi.fn().mockResolvedValue({ success: true }),
  };
  const consumer = new BenefitsCarrierConsumer(
    { subscribe: vi.fn() } as never,
    { consume: vi.fn(), registerReplayHandler: vi.fn() } as never,
    carrierAdapter as never,
  );
  const handle = (event: HrEventEnvelope<unknown>) =>
    (consumer as unknown as { handle(event: HrEventEnvelope<unknown>): Promise<void> }).handle(event);
  return { carrierAdapter, handle };
}

function event(eventName: string, payload: Record<string, unknown>): HrEventEnvelope<unknown> {
  return {
    eventId,
    eventName,
    eventSchemaVersion: 1,
    tenantId,
    aggregateType: 'BenefitsEnrollment',
    aggregateId,
    payload,
    metadata: {
      correlationId,
      requestHash: 'test-request',
      clientType: 'SYSTEM',
    },
    privacy: {
      privacyLevel: 'INTERNAL',
      dataClasses: [],
      retentionClass: 'OPERATIONAL',
      crossBorderRestricted: false,
    },
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    version: 1,
  } as unknown as HrEventEnvelope<unknown>;
}

describe('BenefitsCarrierConsumer', () => {
  it('normalizes outbox-shaped benefits enrollment payloads before carrier delivery', async () => {
    const { carrierAdapter, handle } = buildConsumer();

    await handle(event(BENEFITS_ENROLLMENT_EFFECTIVE, {
      enrollmentId,
      workerId,
      programId,
      coverageStartDate: '2026-02-01',
    }));

    expect(carrierAdapter.sendEnrollment).toHaveBeenCalledWith(expect.objectContaining({
      enrollmentId: new Uuid(enrollmentId),
      workerId: new Uuid(workerId),
      programId: new Uuid(programId),
      coverageStartDate: '2026-02-01',
    }));
  });

  it('normalizes outbox-shaped processed life event payloads before carrier delivery', async () => {
    const { carrierAdapter, handle } = buildConsumer();

    await handle(event(LIFE_EVENT_PROCESSED, {
      lifeEventId,
      workerId,
      eventType: 'MARRIAGE',
      effectiveDate: '2026-03-01',
    }));

    expect(carrierAdapter.sendLifeEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      lifeEventId: new Uuid(lifeEventId),
      workerId: new Uuid(workerId),
      eventType: 'MARRIAGE',
      effectiveDate: '2026-03-01',
    }));
  });

  it('normalizes UUID value variants for enrollment and life event carrier updates', async () => {
    const { carrierAdapter, handle } = buildConsumer();

    await handle(event(BENEFITS_ENROLLMENT_EFFECTIVE, {
      enrollmentId: new Uuid(enrollmentId),
      workerId: { value: workerId },
      programId,
      coverageStartDate: ' 2026-02-01 ',
    }));
    await handle(event(LIFE_EVENT_PROCESSED, {
      lifeEventId: { value: lifeEventId },
      workerId: new Uuid(workerId),
      lifeEventType: ' BIRTH ',
      effectiveDate: ' 2026-04-01 ',
    }));

    expect(carrierAdapter.sendEnrollment).toHaveBeenCalledWith(expect.objectContaining({
      enrollmentId: new Uuid(enrollmentId),
      workerId: new Uuid(workerId),
      programId: new Uuid(programId),
      coverageStartDate: '2026-02-01',
    }));
    expect(carrierAdapter.sendLifeEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      lifeEventId: new Uuid(lifeEventId),
      workerId: new Uuid(workerId),
      eventType: 'BIRTH',
      effectiveDate: '2026-04-01',
    }));
  });

  it.each([
    ['enrollmentId', { workerId, programId, coverageStartDate: '2026-02-01' }],
    ['workerId', { enrollmentId, programId, coverageStartDate: '2026-02-01' }],
    ['programId', { enrollmentId, workerId, coverageStartDate: '2026-02-01' }],
    ['coverageStartDate', { enrollmentId, workerId, programId, coverageStartDate: '   ' }],
  ])('rejects enrollment events missing %s', async (field, payload) => {
    const { carrierAdapter, handle } = buildConsumer();

    await expect(handle(event(BENEFITS_ENROLLMENT_EFFECTIVE, payload))).rejects.toThrow(
      `Benefits carrier event payload is missing ${field}`,
    );
    expect(carrierAdapter.sendEnrollment).not.toHaveBeenCalled();
  });

  it.each([
    ['lifeEventId', { workerId, eventType: 'MARRIAGE', effectiveDate: '2026-03-01' }],
    ['workerId', { lifeEventId, eventType: 'MARRIAGE', effectiveDate: '2026-03-01' }],
    ['eventType', { lifeEventId, workerId, effectiveDate: '2026-03-01' }],
    ['effectiveDate', { lifeEventId, workerId, eventType: 'MARRIAGE', effectiveDate: '   ' }],
  ])('rejects life events missing %s', async (field, payload) => {
    const { carrierAdapter, handle } = buildConsumer();

    await expect(handle(event(LIFE_EVENT_PROCESSED, payload))).rejects.toThrow(
      `Benefits carrier event payload is missing ${field}`,
    );
    expect(carrierAdapter.sendLifeEventUpdate).not.toHaveBeenCalled();
  });
});
