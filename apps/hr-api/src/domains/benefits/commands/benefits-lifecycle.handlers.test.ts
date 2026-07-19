import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';
import { BenefitsEnrollment } from '../aggregates/benefits-enrollment.aggregate.js';
import { BenefitsProgram } from '../aggregates/benefits-program.aggregate.js';
import { BenefitsLifeEvent } from '../aggregates/benefits-life-event.aggregate.js';
import { CreateBenefitsEnrollmentHandler } from './create-benefits-enrollment.handler.js';
import { ApproveBenefitsEnrollmentHandler } from './approve-benefits-enrollment.handler.js';
import { MakeEffectiveBenefitsEnrollmentHandler } from './make-effective-benefits-enrollment.handler.js';
import { TerminateBenefitsEnrollmentHandler } from './terminate-benefits-enrollment.handler.js';
import { CreateBenefitsLifeEventHandler } from './create-benefits-life-event.handler.js';
import { ProcessBenefitsLifeEventHandler } from './process-benefits-life-event.handler.js';
import { RejectBenefitsLifeEventHandler } from './reject-benefits-life-event.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const commandId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');
const workerId = new Uuid('00000000-0000-0000-0000-000000000005');
const programId = new Uuid('00000000-0000-0000-0000-000000000006');
const enrollmentId = new Uuid('00000000-0000-0000-0000-000000000007');
const lifeEventId = new Uuid('00000000-0000-0000-0000-000000000008');

function command(commandName: string, aggregateType: string, payload: unknown, aggregateId?: Uuid): HrCommandEnvelope<unknown> {
  return {
    commandId,
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['BENEFITS_ADMIN'],
      permissions: ['benefits:write'],
      mfaAuthenticated: true,
    },
    aggregateType,
    aggregateId,
    idempotencyKey: `${commandName}-key`,
    correlationId,
    reason: 'benefits lifecycle test',
    payload,
    metadata: {
      requestHash: `${commandName}-hash`,
      clientType: 'HR_ADMIN',
      hrDataSensitivity: 'LOW',
    },
  };
}

function enrollment(status: BenefitsEnrollment['status']) {
  return new BenefitsEnrollment({
    id: enrollmentId,
    tenantId,
    workerId,
    programId,
    coverageLevel: 'EMPLOYEE',
    dependents: [],
    effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
    premiumAmount: 450,
    currency: 'USD',
    status,
    aggregateVersion: 1,
  });
}

function program() {
  return new BenefitsProgram({
    id: programId,
    tenantId,
    programName: 'Premium PPO',
    programType: 'MEDICAL',
    monthlyPremium: 450,
    currency: 'USD',
    status: 'ACTIVE',
    aggregateVersion: 1,
  });
}

function lifeEvent(status: BenefitsLifeEvent['status']) {
  return new BenefitsLifeEvent({
    id: lifeEventId,
    tenantId,
    workerId,
    eventType: 'MARRIAGE',
    eventDate: new Date('2026-02-14T00:00:00.000Z'),
    status,
    aggregateVersion: 1,
  });
}

describe('Benefits lifecycle command handlers', () => {
  it('creates and submits an enrollment so employee requests are persisted as actionable domain work', async () => {
    const repo = { save: vi.fn(async () => undefined) };
    const programRepo = { findById: vi.fn(async () => program()) };
    const handler = new CreateBenefitsEnrollmentHandler(
      repo as never,
      programRepo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['SendForApproval']) } as never,
    );

    const result = await handler.handle(command('CreateBenefitsEnrollment', 'BenefitsEnrollment', {
      enrollmentId,
      workerId,
      programId,
      coverageLevel: 'EMPLOYEE',
      dependents: [],
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
    }));

    const saved = repo.save.mock.calls[0]?.[0] as BenefitsEnrollment;
    expect(saved.status).toBe('SUBMITTED');
    expect(programRepo.findById).toHaveBeenCalledWith(programId);
    // The enrollment must snapshot the program's premium rate at creation time,
    // not defer to a live lookup later, so the employee's contracted rate stays
    // stable even if the program's rate changes.
    expect(saved.premiumAmount).toBe(450);
    expect(saved.currency).toBe('USD');
    expect(result).toEqual(expect.objectContaining({
      success: true,
      aggregateId: enrollmentId,
      newState: 'SUBMITTED',
      eventsEmitted: ['BenefitsEnrollmentSubmitted'],
    }));
    expect(result.data).toEqual(expect.objectContaining({
      enrollmentId: enrollmentId.value,
      workerId: workerId.value,
      premiumAmount: 450,
      currency: 'USD',
      status: 'SUBMITTED',
    }));
  });

  it('rejects enrollment creation when the referenced program does not exist', async () => {
    const repo = { save: vi.fn(async () => undefined) };
    const programRepo = { findById: vi.fn(async () => undefined) };
    const handler = new CreateBenefitsEnrollmentHandler(
      repo as never,
      programRepo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    await expect(handler.handle(command('CreateBenefitsEnrollment', 'BenefitsEnrollment', {
      enrollmentId,
      workerId,
      programId,
      coverageLevel: 'EMPLOYEE',
      dependents: [],
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
    }))).rejects.toThrow('BenefitsProgram not found');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('approves a submitted enrollment through the canonical aggregate and persists the new state', async () => {
    const existing = enrollment('SUBMITTED');
    const repo = {
      findById: vi.fn(async () => existing),
      save: vi.fn(async () => undefined),
    };
    const handler = new ApproveBenefitsEnrollmentHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['MakeEffective', 'Terminate']) } as never,
    );

    const result = await handler.handle(command('ApproveBenefitsEnrollment', 'BenefitsEnrollment', {
      enrollmentId,
      approvedBy: actorId,
    }, enrollmentId));

    expect(repo.findById).toHaveBeenCalledWith(enrollmentId);
    expect(repo.save).toHaveBeenCalledWith(existing);
    expect(existing.status).toBe('APPROVED');
    expect(result).toEqual(expect.objectContaining({
      newState: 'APPROVED',
      newVersion: 3,
      eventsEmitted: ['BenefitsEnrollmentApproved'],
      auditRecordId: commandId,
    }));
    expect(result.data).toEqual(expect.objectContaining({
      enrollmentId: enrollmentId.value,
      workerId: workerId.value,
      approvedBy: actorId.value,
      status: 'APPROVED',
    }));
  });

  it('terminates approved enrollment coverage and emits the termination event for outbox processing', async () => {
    const existing = enrollment('APPROVED');
    const repo = {
      findById: vi.fn(async () => existing),
      save: vi.fn(async () => undefined),
    };
    const handler = new TerminateBenefitsEnrollmentHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('TerminateBenefitsEnrollment', 'BenefitsEnrollment', {
      enrollmentId,
      reason: 'employee waived coverage',
    }, enrollmentId));

    expect(existing.status).toBe('TERMINATED');
    expect(result).toEqual(expect.objectContaining({
      newState: 'TERMINATED',
      eventsEmitted: ['BenefitsEnrollmentTerminated'],
    }));
    expect(result.data).toEqual(expect.objectContaining({
      enrollmentId: enrollmentId.value,
      workerId: workerId.value,
      status: 'TERMINATED',
    }));
  });

  it('makes approved enrollment effective with the canonical effective event', async () => {
    const existing = enrollment('APPROVED');
    const repo = {
      findById: vi.fn(async () => existing),
      save: vi.fn(async () => undefined),
    };
    const handler = new MakeEffectiveBenefitsEnrollmentHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['Terminate']) } as never,
    );

    const result = await handler.handle(command('MakeBenefitsEnrollmentEffective', 'BenefitsEnrollment', {
      enrollmentId,
      finalizedBy: actorId,
    }, enrollmentId));

    expect(existing.status).toBe('EFFECTIVE');
    expect(result).toEqual(expect.objectContaining({
      newState: 'EFFECTIVE',
      eventsEmitted: ['BenefitsEnrollmentEffective'],
    }));
    // Tier-0 fix: BenefitsCarrierConsumer requires coverageStartDate, and
    // PayrollInputBuilderSaga requires a non-zero `amount` -- both were
    // previously missing from this handler's data return, so every real
    // BenefitsEnrollmentEffective event threw in the consumer and created a
    // $0 payroll deduction line.
    expect(result.data).toEqual(expect.objectContaining({
      enrollmentId: enrollmentId.value,
      workerId: workerId.value,
      programId: programId.value,
      coverageStartDate: '2026-01-01T00:00:00.000Z',
      amount: 450,
      currency: 'USD',
      status: 'EFFECTIVE',
    }));
  });

  // BenefitsProgram activate/suspend/close command-handler coverage lives in
  // benefits-program-lifecycle.handlers.test.ts, alongside CreateBenefitsProgram.

  it('records life events with schema-complete event payload fields', async () => {
    const repo = { save: vi.fn(async () => undefined) };
    const handler = new CreateBenefitsLifeEventHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['Process']) } as never,
    );

    const result = await handler.handle(command('CreateBenefitsLifeEvent', 'BenefitsLifeEvent', {
      lifeEventId,
      workerId,
      eventType: 'MARRIAGE',
      eventDate: new Date('2026-02-14T00:00:00.000Z'),
      description: 'Marriage certificate uploaded',
    }, lifeEventId));

    expect(result).toEqual(expect.objectContaining({
      newState: 'RECORDED',
      eventsEmitted: ['LifeEventRecorded'],
    }));
    expect(result.data).toEqual(expect.objectContaining({
      lifeEventId: lifeEventId.value,
      workerId: workerId.value,
      lifeEventTypeId: lifeEventId.value,
      recordedBy: actorId.value,
      status: 'RECORDED',
    }));
  });

  it('processes a recorded life event through the canonical life-event aggregate', async () => {
    const existing = lifeEvent('RECORDED');
    const repo = {
      findById: vi.fn(async () => existing),
      save: vi.fn(async () => undefined),
    };
    const handler = new ProcessBenefitsLifeEventHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('ProcessBenefitsLifeEvent', 'BenefitsLifeEvent', {
      lifeEventId,
      processedBy: actorId,
    }, lifeEventId));

    expect(existing.status).toBe('PROCESSED');
    expect(result).toEqual(expect.objectContaining({
      newState: 'PROCESSED',
      eventsEmitted: ['LifeEventProcessed'],
    }));
    // Tier-0 fix: BenefitsCarrierConsumer requires effectiveDate for
    // LifeEventProcessed, which was previously missing from this handler's
    // data return, causing every real event to throw in the consumer.
    expect(result.data).toEqual(expect.objectContaining({
      lifeEventId: lifeEventId.value,
      workerId: workerId.value,
      processedBy: actorId.value,
      effectiveDate: '2026-02-14T00:00:00.000Z',
      status: 'PROCESSED',
    }));
  });

  it('rejects recorded life events with persisted state and an outbox-backed event name', async () => {
    const existing = lifeEvent('RECORDED');
    const repo = {
      findById: vi.fn(async () => existing),
      save: vi.fn(async () => undefined),
    };
    const handler = new RejectBenefitsLifeEventHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('RejectBenefitsLifeEvent', 'BenefitsLifeEvent', {
      lifeEventId,
      rejectedBy: actorId,
      reason: 'missing evidence',
    }, lifeEventId));

    expect(existing.status).toBe('REJECTED');
    expect(result).toEqual(expect.objectContaining({
      newState: 'REJECTED',
      eventsEmitted: ['LifeEventRejected'],
    }));
    expect(result.data).toEqual(expect.objectContaining({
      lifeEventId: lifeEventId.value,
      workerId: workerId.value,
      rejectedBy: actorId.value,
      status: 'REJECTED',
    }));
  });
});
