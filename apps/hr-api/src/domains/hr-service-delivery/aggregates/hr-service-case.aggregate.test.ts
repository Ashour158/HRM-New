import { describe, expect, it } from 'vitest';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { HrServiceCase } from './hr-service-case.aggregate.js';

function openCase(overrides: Partial<Parameters<typeof HrServiceCase.open>[0]> = {}): HrServiceCase {
  return HrServiceCase.open(
    {
      id: Uuid.generate(),
      tenantId: Uuid.generate(),
      caseNumber: 'HR-2026-0001',
      requesterWorkerId: Uuid.generate(),
      caseType: 'PAYROLL_HELP',
      priority: 'MEDIUM',
      description: 'My payslip deduction looks wrong.',
      ...overrides,
    },
    Uuid.generate(),
  );
}

describe('HrServiceCase aggregate escalation', () => {
  it('escalates an open case, recording the reason, escalator, and timestamp', () => {
    const serviceCase = openCase();
    const escalatedBy = Uuid.generate();

    serviceCase.escalate('Employee threatened legal action over unpaid wages.', escalatedBy, Uuid.generate());

    expect(serviceCase.status).toBe('ESCALATED');
    expect(serviceCase.escalationReason).toBe('Employee threatened legal action over unpaid wages.');
    expect(serviceCase.escalatedBy?.value).toBe(escalatedBy.value);
    expect(serviceCase.escalatedAt).toBeInstanceOf(Date);
    expect(serviceCase.domainEvents.map((e) => e.eventName)).toContain('HrServiceCaseEscalated');
  });

  it('allows escalation from IN_PROGRESS and PENDING_CUSTOMER', () => {
    const inProgress = openCase();
    inProgress.markInProgress(Uuid.generate());
    expect(() => inProgress.escalate('Needs specialist review.', Uuid.generate(), Uuid.generate())).not.toThrow();
    expect(inProgress.status).toBe('ESCALATED');

    const pendingCustomer = openCase();
    pendingCustomer.markInProgress(Uuid.generate());
    pendingCustomer.markPendingCustomer(Uuid.generate());
    expect(() => pendingCustomer.escalate('Needs specialist review.', Uuid.generate(), Uuid.generate())).not.toThrow();
    expect(pendingCustomer.status).toBe('ESCALATED');
  });

  it('rejects escalation once the case is already terminal (ESCALATED or CLOSED)', () => {
    const escalated = openCase();
    escalated.escalate('First escalation.', Uuid.generate(), Uuid.generate());
    expect(() => escalated.escalate('Second escalation.', Uuid.generate(), Uuid.generate())).toThrow(ValidationError);

    const closed = openCase();
    closed.markInProgress(Uuid.generate());
    closed.resolve(Uuid.generate());
    closed.close(Uuid.generate());
    expect(() => closed.escalate('Too late.', Uuid.generate(), Uuid.generate())).toThrow(ValidationError);
  });

  it('rejects an empty escalation reason', () => {
    const serviceCase = openCase();
    expect(() => serviceCase.escalate('   ', Uuid.generate(), Uuid.generate())).toThrow();
  });
});

describe('HrServiceCase aggregate reassignment', () => {
  it('reassigns the case to a new agent and owner group while active', () => {
    const serviceCase = openCase({ assignedTo: undefined });
    const newAssignee = Uuid.generate();

    serviceCase.reassign(newAssignee, Uuid.generate(), 'Payroll Escalations');

    expect(serviceCase.assignedTo?.value).toBe(newAssignee.value);
    expect(serviceCase.ownerGroup).toBe('Payroll Escalations');
    expect(serviceCase.domainEvents.map((e) => e.eventName)).toContain('HrServiceCaseReassigned');
  });

  it('leaves the owner group untouched when reassignment omits it', () => {
    const serviceCase = openCase({ ownerGroup: 'Payroll' });
    serviceCase.reassign(Uuid.generate(), Uuid.generate());
    expect(serviceCase.ownerGroup).toBe('Payroll');
  });

  it('rejects reassignment once the case is resolved, closed, or escalated', () => {
    const resolved = openCase();
    resolved.markInProgress(Uuid.generate());
    resolved.resolve(Uuid.generate());
    expect(() => resolved.reassign(Uuid.generate(), Uuid.generate())).toThrow(ValidationError);

    const escalated = openCase();
    escalated.escalate('Needs escalation.', Uuid.generate(), Uuid.generate());
    expect(() => escalated.reassign(Uuid.generate(), Uuid.generate())).toThrow(ValidationError);
  });
});
