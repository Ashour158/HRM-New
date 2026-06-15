import { describe, expect, it } from 'vitest';
import { FieldAccessDecision, FieldPolicyEngine, type AbacContext } from './field-policy.js';

const baseContext: AbacContext = {
  isSelf: false,
  isManager: false,
  isManagerChain: false,
  isPeer: false,
  legalEntityIds: [],
  countryCodes: [],
  departmentIds: [],
  timeOfAccess: new Date('2026-06-15T08:00:00.000Z'),
  breakGlassActive: false,
  mfaAuthenticated: false,
};

describe('FieldPolicyEngine classification enforcement', () => {
  it('masks high-sensitivity payroll fields without the domain read permission', () => {
    const engine = new FieldPolicyEngine();

    const denied = engine.evaluateFieldAccess(
      'worker.payroll.netPay',
      ['HRBP'],
      baseContext,
      'HIGH_SENSITIVITY',
      ['WORKER_READ'],
    );
    const allowed = engine.evaluateFieldAccess(
      'worker.payroll.netPay',
      ['PAYROLL_ADMIN'],
      baseContext,
      'HIGH_SENSITIVITY',
      ['PAYROLL_READ'],
    );

    expect(denied.decision).toBe(FieldAccessDecision.MASKED);
    expect(denied.maskingRule).toBe('SHOW_RANGE');
    expect(allowed.decision).toBe(FieldAccessDecision.VISIBLE);
  });

  it('requires explicit special-category clearance even for HR admin roles', () => {
    const engine = new FieldPolicyEngine();

    const denied = engine.evaluateFieldAccess(
      'worker.wellbeing.mentalHealthNotes',
      ['HR_ADMIN'],
      baseContext,
      'SPECIAL_CATEGORY',
      ['WORKER_READ'],
    );
    const allowed = engine.evaluateFieldAccess(
      'worker.wellbeing.mentalHealthNotes',
      ['HR_ADMIN'],
      { ...baseContext, mfaAuthenticated: true },
      'SPECIAL_CATEGORY',
      ['WELLBEING_EAP_READ'],
    );

    expect(denied.decision).toBe(FieldAccessDecision.MASKED);
    expect(denied.maskingRule).toBe('FULL_MASK');
    expect(allowed.decision).toBe(FieldAccessDecision.VISIBLE);
  });
});
