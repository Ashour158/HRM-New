import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import type { OutboxPublisher } from '../../../platform/outbox-inbox/outbox-publisher.js';
import { PayrollEventsPublisher } from '../events/payroll-events.publisher.js';
import { PayrollCycle } from '../aggregates/payroll-cycle.aggregate.js';
import { PayrollCalculationSaga } from './payroll-calculation-saga.js';

function openedCycle(tenantId: Uuid): PayrollCycle {
  return new PayrollCycle({
    id: Uuid.generate(),
    tenantId,
    cycleName: 'June Payroll',
    payPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
    payPeriodEnd: new Date('2026-06-30T23:59:59.999Z'),
    status: 'OPENED',
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
 * outbox-envelope pipeline the way the saga uses it in production (the
 * saga bypasses the CommandBus entirely, so this publisher is the only
 * thing standing between a saga-driven state transition and the outbox).
 */
function realEventsPublisher() {
  const scheduled: Array<{ event: HrEventEnvelope<unknown>; tenantId: Uuid; correlationId: Uuid }> = [];
  const outboxPublisher = {
    schedule: vi.fn(async (event: HrEventEnvelope<unknown>, tenantId: Uuid, correlationId: Uuid) => {
      scheduled.push({ event, tenantId, correlationId });
    }),
  } as unknown as OutboxPublisher;
  return { scheduled, outboxPublisher, eventsPublisher: new PayrollEventsPublisher(outboxPublisher) };
}

function payrollCycleOpenedEvent(cycle: PayrollCycle, correlationId: Uuid): HrEventEnvelope<{
  payrollCycleId: Uuid;
  legalEntityId: Uuid;
  periodStartDate: string;
  periodEndDate: string;
  openedBy: Uuid;
}> {
  return {
    eventId: Uuid.generate(),
    eventName: 'PayrollCycleOpened',
    eventSchemaVersion: 1,
    tenantId: cycle.tenantId,
    aggregateId: cycle.id,
    aggregateType: 'PayrollCycle',
    occurredAt: new Date('2026-06-01T00:00:00.000Z'),
    payload: {
      payrollCycleId: cycle.id,
      legalEntityId: Uuid.generate(),
      periodStartDate: '2026-06-01',
      periodEndDate: '2026-06-30',
      openedBy: Uuid.generate(),
    },
    metadata: {
      correlationId,
      causationId: Uuid.generate(),
    },
  } as HrEventEnvelope<{
    payrollCycleId: Uuid;
    legalEntityId: Uuid;
    periodStartDate: string;
    periodEndDate: string;
    openedBy: Uuid;
  }>;
}

describe('PayrollCalculationSaga', () => {
  it('drives the payroll cycle through every stage and schedules every lifecycle event on the transactional outbox', async () => {
    const tenantId = Uuid.generate();
    const cycle = openedCycle(tenantId);
    const { scheduled, outboxPublisher, eventsPublisher } = realEventsPublisher();

    const savedCycleStatuses: string[] = [];
    const savedRuns: Array<{ status: string }> = [];

    const saga = new PayrollCalculationSaga(
      { subscribe: vi.fn() } as never,
      {
        findById: vi.fn(async () => cycle),
        save: vi.fn(async (pc: PayrollCycle) => { savedCycleStatuses.push(pc.status); }),
      } as never,
      {
        save: vi.fn(async (run: { status: string }) => { savedRuns.push(run); }),
      } as never,
      eventsPublisher,
      hcmSetupService() as never,
    );

    const correlationId = Uuid.generate();
    const event = payrollCycleOpenedEvent(cycle, correlationId);

    await (saga as unknown as {
      onPayrollCycleOpened: (event: typeof event) => Promise<void>;
    }).onPayrollCycleOpened(event);

    // The saga bypasses the command bus entirely (repo.save + eventsPublisher),
    // so every state transition must independently reach the outbox -- this is
    // the regression under test (PayrollEventsPublisher was previously a
    // hardcoded no-op stub).
    const eventNames = scheduled.map((entry) => entry.event.eventName);
    expect(eventNames).toEqual([
      'PayrollCycleInputCollectionStarted',
      'PayrollCycleValidationStarted',
      'PayrollCycleCalculationStarted',
      'PayrollCalculationStarted',
      'PayrollCalculationValidated',
      'PayrollCalculationFinalized',
      'PayrollCycleReviewStarted',
    ]);
    expect(outboxPublisher.schedule).toHaveBeenCalledTimes(7);

    const cycleEvents = scheduled.filter((entry) => entry.event.aggregateType === 'PayrollCycle');
    expect(cycleEvents).toHaveLength(4);
    for (const entry of cycleEvents) {
      expect(entry.event.aggregateId.value).toBe(cycle.id.value);
      expect(entry.event.payload).toMatchObject({ payrollCycleId: cycle.id });
      expect(entry.tenantId.value).toBe(tenantId.value);
      expect(entry.correlationId.value).toBe(correlationId.value);
    }

    const runEvents = scheduled.filter((entry) => entry.event.aggregateType === 'PayrollCalculationRun');
    expect(runEvents).toHaveLength(3);
    for (const entry of runEvents) {
      expect(entry.event.payload).toMatchObject({ calculationRunId: entry.event.aggregateId });
      expect(entry.tenantId.value).toBe(tenantId.value);
    }

    expect(savedRuns).toHaveLength(3);
    expect(savedCycleStatuses).toEqual(['INPUT_COLLECTION', 'VALIDATION', 'CALCULATION', 'REVIEW']);
    expect(cycle.status).toBe('REVIEW');

    // Every domain event scheduled must have been cleared from the aggregate
    // afterwards (matching PositionEventsPublisher.publishUncommitted), so a
    // later save/publish cycle never re-publishes a stale event.
    expect(cycle.domainEvents).toHaveLength(0);
  });
});
