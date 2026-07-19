import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import type { OutboxPublisher } from '../../../platform/outbox-inbox/outbox-publisher.js';
import { PayrollEventsPublisher } from '../events/payroll-events.publisher.js';
import { PayrollCycle } from '../aggregates/payroll-cycle.aggregate.js';
import { PayrollInputBuilderSaga } from './payroll-input-builder-saga.js';

function eventFor(date: string, tenantId = Uuid.generate()): HrEventEnvelope<unknown> {
  return {
    eventId: Uuid.generate(),
    eventName: 'TimesheetApproved',
    eventSchemaVersion: 1,
    tenantId,
    aggregateId: Uuid.generate(),
    aggregateType: 'Timesheet',
    occurredAt: new Date(`${date}T10:00:00.000Z`),
    payload: {},
    metadata: {
      correlationId: Uuid.generate(),
      causationId: Uuid.generate(),
      source: 'test',
    },
  } as HrEventEnvelope<unknown>;
}

function activeCycle(tenantId: Uuid): PayrollCycle {
  return new PayrollCycle({
    id: Uuid.generate(),
    tenantId,
    cycleName: 'May Payroll',
    payPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
    payPeriodEnd: new Date('2026-05-31T23:59:59.999Z'),
    status: 'INPUT_COLLECTION',
  });
}

function hcmSetupService() {
  return {
    getSetup: vi.fn(async () => ({
      locations: [{ code: 'CAIRO_HQ', active: true, currency: 'EGP' }],
      cities: [],
      statutoryPayrollPacks: [],
      salaryCompositionPlans: [],
    })),
  };
}

/**
 * Real PayrollEventsPublisher wired to a fake OutboxPublisher that records
 * every scheduled envelope. This exercises the actual aggregate-events ->
 * outbox-envelope pipeline (not just "was the publisher called"), matching
 * how PositionEventsPublisher's outbox-write path is meant to be verified.
 */
function realEventsPublisher() {
  const scheduled: Array<{ event: HrEventEnvelope<unknown>; tenantId: Uuid; correlationId: Uuid }> = [];
  const outboxPublisher = {
    schedule: vi.fn(async (event: HrEventEnvelope<unknown>, tenantId: Uuid, correlationId: Uuid) => {
      scheduled.push({ event, tenantId, correlationId });
    }),
  } as unknown as OutboxPublisher;
  return { scheduled, eventsPublisher: new PayrollEventsPublisher(outboxPublisher) };
}

describe('PayrollInputBuilderSaga', () => {
  it('resolves event-created inputs into the active payroll cycle and schedules a PayrollInputCreated outbox event', async () => {
    const tenantId = Uuid.generate();
    const cycle = activeCycle(tenantId);
    const saved: Array<{ id: Uuid; payrollCycleId: Uuid; workerId: Uuid; inputType: string }> = [];
    const { scheduled, eventsPublisher } = realEventsPublisher();
    const saga = new PayrollInputBuilderSaga(
      { subscribe: vi.fn() } as never,
      { save: vi.fn(async (input) => saved.push(input)) } as never,
      eventsPublisher,
      { findByTenant: vi.fn(async () => [cycle]) } as never,
      hcmSetupService() as never,
    );

    const event = eventFor('2026-05-15', tenantId);
    await (saga as unknown as {
      createInputFromEvent: (
        event: HrEventEnvelope<unknown>,
        input: { source: string; workerId: Uuid; inputType: string; amount: number; currency: string; description: string },
      ) => Promise<void>;
    }).createInputFromEvent(event, {
      source: 'TimesheetApproved',
      workerId: Uuid.generate(),
      inputType: 'TIMESHEET_HOURS',
      amount: 8,
      currency: 'EGP',
      description: 'Timesheet approved',
    });

    expect(saved).toHaveLength(1);
    expect(saved[0].payrollCycleId.value).toBe(cycle.id.value);
    expect(saved[0].inputType).toBe('TIMESHEET_HOURS');

    // The saga bypasses the command bus, so the PayrollInputCreated event
    // must reach the transactional outbox directly via the events publisher
    // -- this is the regression under test (previously a no-op stub).
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].event.eventName).toBe('PayrollInputCreated');
    expect(scheduled[0].event.aggregateType).toBe('PayrollInput');
    expect(scheduled[0].event.aggregateId.value).toBe(saved[0].id.value);
    expect(scheduled[0].event.payload).toMatchObject({ payrollInputId: saved[0].id });
    expect(scheduled[0].tenantId.value).toBe(tenantId.value);
    expect(scheduled[0].correlationId.value).toBe(event.metadata.correlationId.value);
  });

  it('skips input creation when no active payroll cycle covers the event date, and schedules nothing', async () => {
    const saved: unknown[] = [];
    const { scheduled, eventsPublisher } = realEventsPublisher();
    const saga = new PayrollInputBuilderSaga(
      { subscribe: vi.fn() } as never,
      { save: vi.fn(async (input) => saved.push(input)) } as never,
      eventsPublisher,
      { findByTenant: vi.fn(async () => []) } as never,
      hcmSetupService() as never,
    );

    await (saga as unknown as {
      createInputFromEvent: (
        event: HrEventEnvelope<unknown>,
        input: { source: string; workerId: Uuid; inputType: string; amount: number; currency: string; description: string },
      ) => Promise<void>;
    }).createInputFromEvent(eventFor('2026-05-15'), {
      source: 'TimesheetApproved',
      workerId: Uuid.generate(),
      inputType: 'TIMESHEET_HOURS',
      amount: 8,
      currency: 'EGP',
      description: 'Timesheet approved',
    });

    expect(saved).toHaveLength(0);
    expect(scheduled).toHaveLength(0);
  });

  it('creates benefits payroll inputs from effective enrollment events with string UUID payloads', async () => {
    const tenantId = Uuid.generate();
    const cycle = activeCycle(tenantId);
    const workerId = Uuid.generate();
    const enrollmentId = Uuid.generate();
    const saved: Array<{ id: Uuid; payrollCycleId: Uuid; workerId: Uuid; inputType: string; description?: string }> = [];
    const { scheduled, eventsPublisher } = realEventsPublisher();
    const saga = new PayrollInputBuilderSaga(
      { subscribe: vi.fn() } as never,
      { save: vi.fn(async (input) => saved.push(input)) } as never,
      eventsPublisher,
      { findByTenant: vi.fn(async () => [cycle]) } as never,
      hcmSetupService() as never,
    );

    await (saga as unknown as {
      createInputFromBenefits: (event: HrEventEnvelope<unknown>) => Promise<void>;
    }).createInputFromBenefits({
      ...eventFor('2026-05-15', tenantId),
      eventName: 'BenefitsEnrollmentEffective',
      aggregateType: 'BenefitsEnrollment',
      payload: {
        enrollmentId: enrollmentId.value,
        workerId: workerId.value,
      },
    } as HrEventEnvelope<unknown>);

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      workerId,
      payrollCycleId: cycle.id,
      inputType: 'BENEFITS_DEDUCTION',
      description: `Benefits ${enrollmentId.value}`,
    });

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].event.eventName).toBe('PayrollInputCreated');
    expect(scheduled[0].event.aggregateId.value).toBe(saved[0].id.value);
  });
});
