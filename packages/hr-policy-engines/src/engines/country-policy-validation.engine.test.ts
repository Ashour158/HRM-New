import { describe, expect, it } from 'vitest';
import {
  evaluateCountryPolicyPackValidation,
  evaluateCountryPolicyPackImpact,
  type CountryPolicyValidationInput,
} from './country-policy-validation.engine.js';

function validPack(overrides: Partial<CountryPolicyValidationInput> = {}): CountryPolicyValidationInput {
  return {
    countryCode: 'AE',
    sections: { LABOR: { content: { minWage: 1800 } }, PAYROLL: { content: { cycle: 'MONTHLY' } } },
    requiredApprovals: ['LEGAL', 'PAYROLL_TAX'],
    sourceEvidence: { gazette: { reference: 'MOHRE-2026-03', retrievedAt: '2026-01-01' } },
    effectiveFrom: new Date('2026-01-01'),
    effectiveUntil: new Date('2026-12-31'),
    validationType: 'FULL',
    ...overrides,
  };
}

describe('evaluateCountryPolicyPackValidation', () => {
  it('returns VALID for a well-formed pack', () => {
    const result = evaluateCountryPolicyPackValidation(validPack());
    expect(result.decisionCode).toBe('VALID');
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('flags an invalid country code as INVALID (fails closed)', () => {
    const result = evaluateCountryPolicyPackValidation(validPack({ countryCode: 'UAE' }));
    expect(result.valid).toBe(false);
    expect(result.decisionCode).toBe('INVALID');
    expect(result.violations.map((v) => v.code)).toContain('INVALID_COUNTRY_CODE');
  });

  it('rejects a pack with no sections', () => {
    const result = evaluateCountryPolicyPackValidation(validPack({ sections: {} }));
    expect(result.valid).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain('NO_SECTIONS');
  });

  it('rejects a section with empty content', () => {
    const result = evaluateCountryPolicyPackValidation(validPack({ sections: { LABOR: { content: {} } } }));
    expect(result.valid).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain('SECTION_CONTENT_MISSING');
  });

  it('rejects an inverted effective window', () => {
    const result = evaluateCountryPolicyPackValidation(
      validPack({ effectiveFrom: new Date('2026-12-31'), effectiveUntil: new Date('2026-01-01') }),
    );
    expect(result.valid).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain('EFFECTIVE_WINDOW_INVERTED');
  });

  it('returns REQUIRES_REVIEW (not INVALID) for warning-only gaps', () => {
    const result = evaluateCountryPolicyPackValidation(
      validPack({ sourceEvidence: {}, requiredApprovals: [] }),
    );
    expect(result.valid).toBe(true);
    expect(result.decisionCode).toBe('REQUIRES_REVIEW');
    expect(result.violations.map((v) => v.code)).toEqual(
      expect.arrayContaining(['NO_SOURCE_EVIDENCE', 'NO_REQUIRED_APPROVALS']),
    );
  });

  it('accepts a section stored as raw content (no content wrapper)', () => {
    const result = evaluateCountryPolicyPackValidation(validPack({ sections: { TAX: { rate: 0.05 } } }));
    expect(result.valid).toBe(true);
  });
});

describe('evaluateCountryPolicyPackImpact', () => {
  it('derives recalculationRequired from retroactive sections', () => {
    const result = evaluateCountryPolicyPackImpact({ sections: { LABOR: {}, PAYROLL: {} } });
    expect(result.recalculationRequired).toBe(true);
    expect(result.impactedDomains).toContain('PAYROLL');
  });

  it('marks non-retroactive-only packs as not requiring recalculation', () => {
    const result = evaluateCountryPolicyPackImpact({ sections: { LOCAL_FORMS: {} } });
    expect(result.recalculationRequired).toBe(false);
    expect(result.impactLevel).toBe('LOW');
  });

  it('escalates impact level with many retroactive sections', () => {
    const result = evaluateCountryPolicyPackImpact({
      sections: { PAYROLL: {}, TAX: {}, LEAVE: {}, BENEFITS: {} },
    });
    expect(result.impactLevel).toBe('HIGH');
    expect(result.impactedSectionCount).toBe(4);
  });
});
