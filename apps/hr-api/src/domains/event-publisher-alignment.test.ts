import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import type { OutboxPublisher } from '../platform/outbox-inbox/outbox-publisher.js';
import { BenefitsEnrollment } from './benefits/aggregates/benefits-enrollment.aggregate.js';
import { BenefitsEventsPublisher } from './benefits/events/benefits-events.publisher.js';
import { AbsenceRequest } from './absence-leave/aggregates/absence-request.aggregate.js';
import { AbsenceLeaveEventsPublisher } from './absence-leave/events/absence-leave-events.publisher.js';
import { Timesheet } from './time-attendance/aggregates/timesheet.aggregate.js';
import { TimeAttendanceEventsPublisher } from './time-attendance/events/time-attendance-events.publisher.js';
import { PayrollInput } from './payroll/aggregates/payroll-input.aggregate.js';
import { PayrollEventsPublisher } from './payroll/events/payroll-events.publisher.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440001');
const approverId = new Uuid('550e8400-e29b-41d4-a716-446655440002');
const correlationId = new Uuid('550e8400-e29b-41d4-a716-446655440003');

function command(): HrCommandEnvelope<unknown> {
  return {
    commandId: new Uuid('550e8400-e29b-41d4-a716-446655440004'),
    commandName: 'MakeBenefitsEnrollmentEffective',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: approverId,
      roles: ['HR_ADMIN'],
      permissions: [],
      mfaAuthenticated: true,
    },
    aggregateType: 'BenefitsEnrollment',
    aggregateId: new Uuid('550e8400-e29b-41d4-a716-446655440005'),
    idempotencyKey: 'event-publisher-alignment',
    correlationId,
    payload: {},
    metadata: { requestHash: 'event-publisher-alignment', clientType: 'HR_ADMIN' },
  };
}

describe('domain event publisher schema alignment', () => {
  it('keeps attendance approvals on the aggregate for CommandBus outbox publication', async () => {
    const eventBus = { publish: vi.fn(async () => undefined) };
    const publisher = new TimeAttendanceEventsPublisher();
    const timesheet = Timesheet.create({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440010'),
      tenantId,
      workerId,
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-05-15T00:00:00.000Z'),
      entries: [{ date: new Date('2026-05-01T00:00:00.000Z'), hours: 8 }],
    }, correlationId);
    timesheet.submit(correlationId);
    timesheet.approve(approverId, correlationId);

    await publisher.publishFromAggregate(timesheet);
    const eventNames = timesheet.domainEvents.map((event) => event.eventName);

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(eventNames).toContain('TimesheetApproved');
    expect(timesheet.workerId.value).toBe(workerId.value);
  });

  it('keeps absence approvals on the aggregate for CommandBus outbox publication', async () => {
    const eventBus = { publish: vi.fn(async () => undefined) };
    const publisher = new AbsenceLeaveEventsPublisher();
    const absence = AbsenceRequest.create({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440020'),
      tenantId,
      workerId,
      absenceType: 'ANNUAL',
      startDate: new Date('2026-05-04T00:00:00.000Z'),
      endDate: new Date('2026-05-05T00:00:00.000Z'),
      durationUnit: 'DAYS',
      durationAmount: 2,
      paid: true,
      deductFromBalance: true,
      payrollImpact: 'PAID_LEAVE',
    }, correlationId);
    absence.submit(correlationId);
    absence.approve(approverId, correlationId);

    await publisher.publishFromAggregate(absence);
    const eventNames = absence.domainEvents.map((event) => event.eventName);

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(eventNames).toContain('AbsenceRequestApproved');
    expect(absence.workerId.value).toBe(workerId.value);
    expect(absence.payrollImpact).toBe('PAID_LEAVE');
  });

  it('keeps payroll command-handler flows on the aggregate for CommandBus outbox publication (handlers no longer call the publisher)', async () => {
    // Unlike the other three domains, payroll command handlers do not inject
    // PayrollEventsPublisher at all: CommandBus.stepWriteOutbox already writes
    // CommandResult.eventsEmitted to the outbox transactionally, so a handler
    // calling this publisher too would double-publish. The uncommitted domain
    // events therefore stay on the aggregate for the bus to read via
    // `eventsEmitted: input.domainEvents.map((e) => e.eventName)`, exactly as
    // in the other three domains.
    const input = PayrollInput.create({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440030'),
      tenantId,
      workerId,
      payrollCycleId: new Uuid('550e8400-e29b-41d4-a716-446655440031'),
      inputType: 'APPROVED_LEAVE',
      amount: 0,
      currency: 'EGP',
    }, correlationId);
    input.submit(correlationId);
    const eventNames = input.domainEvents.map((event) => event.eventName);

    expect(eventNames).toEqual(['PayrollInputCreated', 'PayrollInputSubmitted']);
    expect(input.workerId.value).toBe(workerId.value);
  });

  it('schedules payroll saga events on the transactional outbox and drains them from the aggregate (payroll sagas bypass the CommandBus)', async () => {
    // PayrollCalculationSaga and PayrollInputBuilderSaga mutate aggregates and
    // call repo.save() directly, bypassing CommandBus entirely -- there is no
    // stepWriteOutbox for them. PayrollEventsPublisher is therefore real (not
    // a no-op) and must actually reach the outbox, mirroring
    // PositionEventsPublisher.publishUncommitted exactly.
    const scheduled: Array<{ event: HrEventEnvelope<unknown>; tenantId: Uuid; correlationId: Uuid }> = [];
    const outboxPublisher = {
      schedule: vi.fn(async (event: HrEventEnvelope<unknown>, scheduledTenantId: Uuid, scheduledCorrelationId: Uuid) => {
        scheduled.push({ event, tenantId: scheduledTenantId, correlationId: scheduledCorrelationId });
      }),
    } as unknown as OutboxPublisher;
    const publisher = new PayrollEventsPublisher(outboxPublisher);
    const input = PayrollInput.create({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440032'),
      tenantId,
      workerId,
      payrollCycleId: new Uuid('550e8400-e29b-41d4-a716-446655440031'),
      inputType: 'APPROVED_LEAVE',
      amount: 0,
      currency: 'EGP',
    }, correlationId);
    input.submit(correlationId);

    await publisher.publishUncommitted(input, tenantId, correlationId);

    expect(outboxPublisher.schedule).toHaveBeenCalledTimes(2);
    expect(scheduled.map((entry) => entry.event.eventName)).toEqual(['PayrollInputCreated', 'PayrollInputSubmitted']);
    expect(scheduled.every((entry) => entry.event.aggregateType === 'PayrollInput')).toBe(true);
    expect(scheduled.every((entry) => entry.tenantId.value === tenantId.value)).toBe(true);
    // Matches PositionEventsPublisher.publishUncommitted: events are drained
    // from the aggregate once scheduled, so a later publish never re-sends them.
    expect(input.domainEvents).toHaveLength(0);
  });

  it('keeps benefits effective events on the aggregate for CommandBus outbox publication', async () => {
    const eventBus = { publishAll: vi.fn(async () => undefined) };
    const publisher = new BenefitsEventsPublisher();
    const enrollment = BenefitsEnrollment.create({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440040'),
      tenantId,
      workerId,
      programId: new Uuid('550e8400-e29b-41d4-a716-446655440041'),
      coverageLevel: 'FAMILY',
      dependents: [],
      effectiveDate: new Date('2026-05-01T00:00:00.000Z'),
      premiumAmount: 600,
      currency: 'USD',
      correlationId,
    });
    enrollment.submit(correlationId);
    enrollment.sendForApproval(correlationId);
    enrollment.approve(correlationId);
    enrollment.makeEffective(correlationId);

    await publisher.publishAll(enrollment, command());
    const eventNames = enrollment.domainEvents.map((event) => event.eventName);
    const effective = enrollment.domainEvents.find((event) => event.eventName === 'BenefitsEnrollmentEffective');

    expect(eventBus.publishAll).not.toHaveBeenCalled();
    expect(eventNames).toEqual([
      'BenefitsEnrollmentSubmitted',
      'BenefitsEnrollmentApproved',
      'BenefitsEnrollmentEffective',
    ]);
    expect(effective).toMatchObject({
      aggregateType: 'BenefitsEnrollment',
      aggregateId: enrollment.id,
      tenantId,
      correlationId,
    });
    expect(enrollment.workerId.value).toBe(workerId.value);
  });
});
