import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { HrEventEnvelope } from '@hcm/event-schemas';
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
  it('publishes attendance approvals with worker identity and employee notification privacy', async () => {
    const published: HrEventEnvelope<unknown>[] = [];
    const publisher = new TimeAttendanceEventsPublisher({ publish: vi.fn(async (event) => published.push(event)) } as never);
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
    const approved = published.find((event) => event.eventName === 'TimesheetApproved');

    expect(approved).toMatchObject({
      payload: {
        workerId: workerId.value,
        approvedBy: approverId.value,
      },
      privacy: {
        subjectWorkerId: workerId.value,
        employeeDataCategory: 'PROFILE',
      },
    });
  });

  it('publishes absence approvals with the worker as the privacy subject', async () => {
    const published: HrEventEnvelope<unknown>[] = [];
    const publisher = new AbsenceLeaveEventsPublisher({ publish: vi.fn(async (event) => published.push(event)) } as never);
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
    const approved = published.find((event) => event.eventName === 'AbsenceRequestApproved');

    expect(approved).toMatchObject({
      payload: {
        workerId: workerId.value,
        approvedBy: approverId.value,
        payrollImpact: 'PAID_LEAVE',
      },
      privacy: {
        subjectWorkerId: workerId.value,
      },
    });
  });

  it('publishes payroll inputs with payroll privacy tied to the worker', async () => {
    const published: HrEventEnvelope<unknown>[] = [];
    const publisher = new PayrollEventsPublisher({ publish: vi.fn(async (event) => published.push(event)) } as never);
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
    const submitted = published.find((event) => event.eventName === 'PayrollInputSubmitted');

    expect(submitted).toMatchObject({
      payload: {
        workerId: workerId.value,
      },
      privacy: {
        piiClassification: 'HIGH',
        employeeDataCategory: 'PAYROLL',
        subjectWorkerId: workerId.value,
      },
    });
  });

  it('publishes benefits effective events with worker identity for payroll and notifications', async () => {
    const published: HrEventEnvelope<unknown>[][] = [];
    const publisher = new BenefitsEventsPublisher({ publishAll: vi.fn(async (events) => published.push(events)) } as never);
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
    const effective = published.flat().find((event) => event.eventName === 'BenefitsEnrollmentEffective');

    expect(effective).toMatchObject({
      payload: {
        workerId: workerId.value,
      },
      privacy: {
        employeeDataCategory: 'BENEFITS',
        subjectWorkerId: workerId.value,
      },
    });
  });
});
