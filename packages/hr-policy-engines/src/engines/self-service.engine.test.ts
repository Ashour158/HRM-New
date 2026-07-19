import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { SelfServiceAuthorityEngine } from './self-service.engine.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('550e8400-e29b-41d4-a716-446655440001');
const correlationId = new Uuid('550e8400-e29b-41d4-a716-446655440002');

const context = {
  tenantId,
  actorId,
  correlationId,
  effectiveDate: new Date('2026-06-03T08:00:00.000Z'),
};

describe('SelfServiceAuthorityEngine', () => {
  it('allows an employee self-service leave request command', async () => {
    const engine = new SelfServiceAuthorityEngine();

    const decision = await engine.execute({
      actorType: 'EMPLOYEE',
      commandName: 'SubmitAbsenceRequest',
      actorRoles: ['EMPLOYEE'],
      abacContext: {
        aggregateType: 'AbsenceRequest',
        commandType: 'CREATE',
      },
    }, context);

    expect(decision.decisionCode).toBe('ALLOWED');
  });

  it('allows employee time clock commands without treating "clock" as an admin lock command', async () => {
    const engine = new SelfServiceAuthorityEngine();

    const decision = await engine.execute({
      actorType: 'EMPLOYEE',
      commandName: 'RecordTimeClockEvent',
      actorRoles: ['EMPLOYEE'],
      abacContext: {
        aggregateType: 'TimeClockEvent',
        commandType: 'READ',
      },
    }, context);

    expect(decision.decisionCode).toBe('ALLOWED');
  });

  it('allows an employee to submit their own performance self-review (HCM-P0-10)', async () => {
    const engine = new SelfServiceAuthorityEngine();

    const decision = await engine.execute({
      actorType: 'EMPLOYEE',
      commandName: 'SubmitSelfReview',
      actorRoles: ['EMPLOYEE'],
      abacContext: {
        aggregateType: 'PerformanceReview',
        commandType: 'UPDATE',
      },
    }, context);

    expect(decision.decisionCode).toBe('ALLOWED');
  });

  it('forbids an employee from executing administrative payroll commands', async () => {
    const engine = new SelfServiceAuthorityEngine();

    const decision = await engine.execute({
      actorType: 'EMPLOYEE',
      commandName: 'ApprovePayrollCycle',
      actorRoles: ['EMPLOYEE'],
      abacContext: {
        aggregateType: 'PayrollCycle',
        commandType: 'APPROVE',
      },
    }, context);

    expect(decision.decisionCode).toBe('FORBIDDEN');
    expect(decision.explanation).toContain('not allowed');
  });

  it('allows a PAYROLL_APPROVER actor to approve a payroll cycle (HCM-P0-5)', async () => {
    // PAYROLL_APPROVER (packages/hr-access-control/src/rbac/roles.ts) holds
    // PAYROLL_APPROVE without PAYROLL_CREATE so it can pass the
    // preparer/approver SoD gate that PAYROLL_ADMIN can never satisfy. This
    // is an independent gate keyed off ADMIN_ROLES/actorRoles (not the
    // mapped actorType), so it must recognize the role by name too -- or
    // PayrollCycle, an ADMIN_ONLY_AGGREGATES entry, is forbidden to every
    // role in the RBAC catalog that can legally approve a cycle.
    const engine = new SelfServiceAuthorityEngine();

    const decision = await engine.execute({
      actorType: 'HR_ADMIN',
      commandName: 'ApprovePayrollCycle',
      actorRoles: ['PAYROLL_APPROVER'],
      abacContext: {
        aggregateType: 'PayrollCycle',
        commandType: 'APPROVE',
      },
    }, context);

    expect(decision.decisionCode).toBe('ALLOWED');
  });
});
