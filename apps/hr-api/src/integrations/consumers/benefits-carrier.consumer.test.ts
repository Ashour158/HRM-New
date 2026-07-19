import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { MakeEffectiveBenefitsEnrollmentHandler } from '../../domains/benefits/commands/make-effective-benefits-enrollment.handler.js';
import { ProcessBenefitsLifeEventHandler } from '../../domains/benefits/commands/process-benefits-life-event.handler.js';
import { BenefitsEnrollment } from '../../domains/benefits/aggregates/benefits-enrollment.aggregate.js';
import { BenefitsLifeEvent } from '../../domains/benefits/aggregates/benefits-life-event.aggregate.js';
import { BenefitsEventsPublisher } from '../../domains/benefits/events/benefits-events.publisher.js';
import { BenefitsCarrierConsumer } from './benefits-carrier.consumer.js';

const BENEFITS_ENROLLMENT_EFFECTIVE = 'BenefitsEnrollmentEffective';
const LIFE_EVENT_PROCESSED = 'LifeEventProcessed';
const BENEFITS_ENROLLMENT_TERMINATED = 'BenefitsEnrollmentTerminated';
const SPENDING_ACCOUNT_CLOSED = 'SpendingAccountClosed';
const BENEFITS_PROGRAM_CLOSED = 'BenefitsProgramClosed';
const CARRIER_RECONCILIATION_VARIANCE_DETECTED = 'CarrierReconciliationVarianceDetected';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const eventId = new Uuid('00000000-0000-0000-0000-000000000002');
const aggregateId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');
const enrollmentId = '00000000-0000-0000-0000-000000000101';
const workerId = '00000000-0000-0000-0000-000000000102';
const programId = '00000000-0000-0000-0000-000000000103';
const lifeEventId = '00000000-0000-0000-0000-000000000201';
const accountId = '00000000-0000-0000-0000-000000000301';
const runId = '00000000-0000-0000-0000-000000000401';

function buildConsumer() {
  const carrierAdapter = {
    sendEnrollment: vi.fn().mockResolvedValue({ success: true }),
    sendLifeEventUpdate: vi.fn().mockResolvedValue({ success: true }),
    sendTermination: vi.fn().mockResolvedValue({ success: true }),
    sendSpendingAccountClosure: vi.fn().mockResolvedValue({ success: true }),
  };
  const commandBus = {
    execute: vi.fn().mockResolvedValue({ success: true }),
  };
  const reminderEmitter = {
    emit: vi.fn().mockResolvedValue({ status: 'PUBLISHED', dispatchKey: 'test' }),
  };
  const systemActorFactory = {
    createForJob: vi.fn(() => ({
      actorId: Uuid.generate(),
      actorType: 'SYSTEM',
      roles: ['SYSTEM_SCHEDULER'],
      permissions: ['benefits:write'],
      mfaAuthenticated: true,
    })),
  };
  const enrollmentRepo = {
    findByProgram: vi.fn().mockResolvedValue([]),
  };
  const consumer = new BenefitsCarrierConsumer(
    { subscribe: vi.fn() } as never,
    { consume: vi.fn(), registerReplayHandler: vi.fn() } as never,
    carrierAdapter as never,
    commandBus as never,
    reminderEmitter as never,
    systemActorFactory as never,
    enrollmentRepo as never,
  );
  const handle = (event: HrEventEnvelope<unknown>) =>
    (consumer as unknown as { handle(event: HrEventEnvelope<unknown>): Promise<void> }).handle(event);
  return { carrierAdapter, commandBus, reminderEmitter, enrollmentRepo, handle };
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

  describe('Tier-0 fix: real handler payloads no longer throw', () => {
    const enrollmentActor = {
      actorType: 'USER' as const,
      actorId: new Uuid('00000000-0000-0000-0000-000000000099'),
      roles: ['BENEFITS_ADMIN'],
      permissions: ['benefits:write'],
      mfaAuthenticated: true,
    };

    it('accepts the MakeEffectiveBenefitsEnrollment handler output without throwing and forwards coverageStartDate', async () => {
      const enrollment = new BenefitsEnrollment({
        id: new Uuid(enrollmentId),
        tenantId,
        workerId: new Uuid(workerId),
        programId: new Uuid(programId),
        coverageLevel: 'EMPLOYEE',
        dependents: [],
        effectiveDate: new Date('2026-02-01T00:00:00.000Z'),
        premiumAmount: 450,
        currency: 'USD',
        status: 'APPROVED',
        aggregateVersion: 1,
      });
      const handler = new MakeEffectiveBenefitsEnrollmentHandler(
        { findById: vi.fn(async () => enrollment), save: vi.fn(async () => undefined) } as never,
        new BenefitsEventsPublisher(),
        { getAllowedActions: vi.fn(() => []) } as never,
      );
      const commandResult = await handler.handle({
        commandId: eventId,
        commandName: 'MakeEffectiveBenefitsEnrollment',
        commandSchemaVersion: 1,
        tenantId,
        actor: enrollmentActor,
        aggregateType: 'BenefitsEnrollment',
        aggregateId: new Uuid(enrollmentId),
        idempotencyKey: 'make-effective-key',
        correlationId,
        reason: 'test',
        payload: { enrollmentId: new Uuid(enrollmentId) },
        metadata: { requestHash: 'hash', clientType: 'HR_ADMIN', hrDataSensitivity: 'LOW' },
      } as never);

      const { carrierAdapter, handle } = buildConsumer();
      // Outbox payload for the outbound event is exactly the handler's `data`.
      await expect(handle(event(BENEFITS_ENROLLMENT_EFFECTIVE, commandResult.data as Record<string, unknown>))).resolves.not.toThrow();
      expect(carrierAdapter.sendEnrollment).toHaveBeenCalledWith(expect.objectContaining({
        enrollmentId: new Uuid(enrollmentId),
        workerId: new Uuid(workerId),
        programId: new Uuid(programId),
        coverageStartDate: '2026-02-01T00:00:00.000Z',
      }));
    });

    it('accepts the ProcessBenefitsLifeEvent handler output without throwing and forwards effectiveDate', async () => {
      const lifeEvent = new BenefitsLifeEvent({
        id: new Uuid(lifeEventId),
        tenantId,
        workerId: new Uuid(workerId),
        eventType: 'MARRIAGE',
        eventDate: new Date('2026-03-01T00:00:00.000Z'),
        status: 'RECORDED',
        aggregateVersion: 1,
      });
      const handler = new ProcessBenefitsLifeEventHandler(
        { findById: vi.fn(async () => lifeEvent), save: vi.fn(async () => undefined) } as never,
        new BenefitsEventsPublisher(),
        { getAllowedActions: vi.fn(() => []) } as never,
      );
      const commandResult = await handler.handle({
        commandId: eventId,
        commandName: 'ProcessBenefitsLifeEvent',
        commandSchemaVersion: 1,
        tenantId,
        actor: enrollmentActor,
        aggregateType: 'BenefitsLifeEvent',
        aggregateId: new Uuid(lifeEventId),
        idempotencyKey: 'process-life-event-key',
        correlationId,
        reason: 'test',
        payload: { lifeEventId: new Uuid(lifeEventId) },
        metadata: { requestHash: 'hash', clientType: 'HR_ADMIN', hrDataSensitivity: 'LOW' },
      } as never);

      const { carrierAdapter, handle } = buildConsumer();
      await expect(handle(event(LIFE_EVENT_PROCESSED, commandResult.data as Record<string, unknown>))).resolves.not.toThrow();
      expect(carrierAdapter.sendLifeEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
        lifeEventId: new Uuid(lifeEventId),
        workerId: new Uuid(workerId),
        eventType: 'MARRIAGE',
        effectiveDate: '2026-03-01T00:00:00.000Z',
      }));
    });
  });

  describe('Part C: new consumer branches', () => {
    it('forwards BenefitsEnrollmentTerminated to the carrier termination call', async () => {
      const { carrierAdapter, handle } = buildConsumer();

      await handle(event(BENEFITS_ENROLLMENT_TERMINATED, {
        enrollmentId,
        workerId,
        reason: 'employee waived coverage',
      }));

      expect(carrierAdapter.sendTermination).toHaveBeenCalledWith(new Uuid(enrollmentId));
    });

    it('forwards SpendingAccountClosed to the carrier-side closure call', async () => {
      const { carrierAdapter, handle } = buildConsumer();

      await handle(event(SPENDING_ACCOUNT_CLOSED, {
        accountId,
        workerId,
        accountType: 'HSA',
      }));

      expect(carrierAdapter.sendSpendingAccountClosure).toHaveBeenCalledWith({
        accountId: new Uuid(accountId),
        workerId: new Uuid(workerId),
        accountType: 'HSA',
      });
    });

    it('auto-terminates EFFECTIVE/APPROVED enrollments via the command bus when a program closes', async () => {
      const { commandBus, enrollmentRepo, handle } = buildConsumer();
      const effectiveEnrollment = { id: new Uuid(enrollmentId), workerId: new Uuid(workerId), status: 'EFFECTIVE' };
      const draftEnrollment = { id: new Uuid('00000000-0000-0000-0000-000000000102'), workerId: new Uuid(workerId), status: 'DRAFT' };
      enrollmentRepo.findByProgram.mockResolvedValue([effectiveEnrollment, draftEnrollment]);

      await handle(event(BENEFITS_PROGRAM_CLOSED, { programId }));

      expect(enrollmentRepo.findByProgram).toHaveBeenCalledWith(new Uuid(programId));
      // Only the EFFECTIVE enrollment is terminable; DRAFT is left untouched.
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const dispatched = commandBus.execute.mock.calls[0]?.[0];
      expect(dispatched).toEqual(expect.objectContaining({
        commandName: 'TerminateBenefitsEnrollment',
        aggregateType: 'BenefitsEnrollment',
        payload: expect.objectContaining({ enrollmentId: effectiveEnrollment.id }),
      }));
    });

    it('routes CarrierReconciliationVarianceDetected to the reminder/escalation mechanism', async () => {
      const { reminderEmitter, handle } = buildConsumer();

      await handle(event(CARRIER_RECONCILIATION_VARIANCE_DETECTED, { runId, varianceAmount: 1250.5 }));

      expect(reminderEmitter.emit).toHaveBeenCalledWith(expect.objectContaining({
        tenantId,
        reminderType: 'CARRIER_RECONCILIATION_VARIANCE',
        subject: expect.objectContaining({ aggregateType: 'CarrierReconciliationRun', subjectId: new Uuid(runId) }),
        payload: expect.objectContaining({ runId, varianceAmount: 1250.5 }),
      }));
    });
  });
});
