import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
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

  it('keeps payroll inputs on the aggregate for CommandBus outbox publication', async () => {
    const eventBus = { publish: vi.fn(async () => undefined) };
    const publisher = new PayrollEventsPublisher();
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

    await publisher.publishFromAggregate(input);
    const eventNames = input.domainEvents.map((event) => event.eventName);

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(eventNames).toContain('PayrollInputSubmitted');
    expect(input.workerId.value).toBe(workerId.value);
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
