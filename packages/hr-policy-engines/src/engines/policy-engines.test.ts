import { describe, expect, it } from 'vitest';
import { evaluateFieldAccess } from './field-access.engine.js';
import { evaluateEmploymentEligibility } from './employment-eligibility.engine.js';
import { evaluatePayrollValidation } from './payroll-validation.engine.js';
import type { CountryPolicyPack } from '../rule-packs/country-policy-pack.js';

describe('evaluateFieldAccess', () => {
  const base = { fieldPath: 'worker.salary', actorRoles: [], abacContext: {}, purpose: 'PAYROLL' };

  it('returns VISIBLE for public/internal data', () => {
    expect(evaluateFieldAccess({ ...base, dataClassification: 'PUBLIC' }).decisionCode).toBe('VISIBLE');
  });

  it('masks confidential data for non-privileged actors', () => {
    expect(evaluateFieldAccess({ ...base, dataClassification: 'CONFIDENTIAL' }).decisionCode).toBe('MASKED');
  });

  it('shows high-sensitivity data to privileged roles with step-up', () => {
    const r = evaluateFieldAccess({ ...base, dataClassification: 'HIGH_SENSITIVITY', actorRoles: ['HR_ADMIN'], abacContext: { mfaAuthenticated: true } });
    expect(r.decisionCode).toBe('VISIBLE');
  });

  it('requires step-up for high-sensitivity without MFA', () => {
    expect(evaluateFieldAccess({ ...base, dataClassification: 'RESTRICTED', actorRoles: ['HR_ADMIN'] }).decisionCode).toBe('REQUIRES_STEP_UP');
  });

  it('denies sensitive access with no declared purpose', () => {
    expect(evaluateFieldAccess({ ...base, dataClassification: 'CONFIDENTIAL', purpose: '' }).decisionCode).toBe('DENIED');
  });

  it('requires break-glass for special-category without an authorised role', () => {
    expect(evaluateFieldAccess({ ...base, dataClassification: 'SPECIAL_CATEGORY' }).decisionCode).toBe('REQUIRES_BREAK_GLASS');
  });

  it('allows special-category for an authorised role with active break-glass', () => {
    const r = evaluateFieldAccess({ ...base, dataClassification: 'SPECIAL_CATEGORY', actorRoles: ['OCCUPATIONAL_HEALTH'], abacContext: { breakGlass: true } });
    expect(r.decisionCode).toBe('VISIBLE');
  });
});

describe('evaluateEmploymentEligibility', () => {
  const ctx = { countryCode: 'AE', legalEntityId: 'le-1' };

  it('is ELIGIBLE with valid authorization and cleared checks', () => {
    const r = evaluateEmploymentEligibility({
      ...ctx,
      workerProfile: { backgroundCheckRequired: true, backgroundCheckStatus: 'PASSED' },
      workAuthorization: { status: 'VALID', expiresAt: '2999-01-01' },
    });
    expect(r.decisionCode).toBe('ELIGIBLE');
  });

  it('requires work authorization when expired', () => {
    const r = evaluateEmploymentEligibility({
      ...ctx,
      workerProfile: {},
      workAuthorization: { status: 'EXPIRED' },
    });
    expect(r.decisionCode).toBe('REQUIRES_WORK_AUTHORIZATION');
  });

  it('requires background check when not cleared', () => {
    const r = evaluateEmploymentEligibility({
      ...ctx,
      workerProfile: { requiresWorkAuthorization: false, backgroundCheckRequired: true, backgroundCheckStatus: 'PENDING' },
      workAuthorization: {},
    });
    expect(r.decisionCode).toBe('REQUIRES_BACKGROUND_CHECK');
  });

  it('is NOT_ELIGIBLE when the profile is flagged ineligible', () => {
    const r = evaluateEmploymentEligibility({ ...ctx, workerProfile: { eligibilityStatus: 'INELIGIBLE' }, workAuthorization: { status: 'VALID' } });
    expect(r.decisionCode).toBe('NOT_ELIGIBLE');
  });
});

describe('evaluatePayrollValidation', () => {
  const pack = { countryCode: 'AE', status: 'PUBLISHED' } as unknown as CountryPolicyPack;

  it('is VALID when every worker has a complete input', () => {
    const r = evaluatePayrollValidation({
      payrollCycle: { cycleId: 'c1', countryCode: 'AE' },
      payrollInputs: [{ workerId: 'w1', grossAmount: 5000 }],
      workerProfiles: [{ workerId: 'w1' }],
      countryPolicyPack: pack,
    });
    expect(r.decisionCode).toBe('VALID');
    expect(r.violations).toHaveLength(0);
  });

  it('is INVALID when a worker has no input', () => {
    const r = evaluatePayrollValidation({
      payrollCycle: { cycleId: 'c1', countryCode: 'AE' },
      payrollInputs: [{ workerId: 'w1', grossAmount: 5000 }],
      workerProfiles: [{ workerId: 'w1' }, { workerId: 'w2' }],
      countryPolicyPack: pack,
    });
    expect(r.decisionCode).toBe('INVALID');
    expect(r.violations.map((v) => v.code)).toContain('MISSING_WORKER_INPUT');
  });

  it('is INVALID on a negative gross amount', () => {
    const r = evaluatePayrollValidation({
      payrollCycle: { cycleId: 'c1', countryCode: 'AE' },
      payrollInputs: [{ workerId: 'w1', grossAmount: -1 }],
      workerProfiles: [{ workerId: 'w1' }],
      countryPolicyPack: pack,
    });
    expect(r.decisionCode).toBe('INVALID');
    expect(r.violations.map((v) => v.code)).toContain('INPUT_NEGATIVE_GROSS');
  });

  it('flags a country mismatch against the policy pack', () => {
    const r = evaluatePayrollValidation({
      payrollCycle: { cycleId: 'c1', countryCode: 'EG' },
      payrollInputs: [{ workerId: 'w1', grossAmount: 100 }],
      workerProfiles: [{ workerId: 'w1' }],
      countryPolicyPack: pack,
    });
    expect(r.violations.map((v) => v.code)).toContain('COUNTRY_MISMATCH');
  });

  it('REQUIRES_REVIEW when the policy pack is not published (warning only)', () => {
    const r = evaluatePayrollValidation({
      payrollCycle: { cycleId: 'c1', countryCode: 'AE' },
      payrollInputs: [{ workerId: 'w1', grossAmount: 100 }],
      workerProfiles: [{ workerId: 'w1' }],
      countryPolicyPack: { countryCode: 'AE', status: 'APPROVED' } as unknown as CountryPolicyPack,
    });
    expect(r.decisionCode).toBe('REQUIRES_REVIEW');
  });
});
