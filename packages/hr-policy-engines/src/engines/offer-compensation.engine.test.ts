import { describe, expect, it } from 'vitest';
import { evaluateOfferCompensation, type OfferCompensationInput } from './offer-compensation.engine.js';

const band = { minSalary: 80_000, midSalary: 100_000, maxSalary: 120_000, currency: 'USD' };

function input(overrides: Partial<OfferCompensationInput> = {}): OfferCompensationInput {
  return { proposedSalary: 100_000, currency: 'USD', band, ...overrides };
}

describe('evaluateOfferCompensation', () => {
  it('APPROVED at midpoint: compa-ratio 1.0, penetration 0.5', () => {
    const r = evaluateOfferCompensation(input());
    expect(r.decisionCode).toBe('APPROVED');
    expect(r.compaRatio).toBe(1);
    expect(r.rangePenetration).toBe(0.5);
    expect(r.violations).toHaveLength(0);
  });

  it('computes compa-ratio and range penetration off-midpoint', () => {
    const r = evaluateOfferCompensation(input({ proposedSalary: 90_000 }));
    expect(r.compaRatio).toBe(0.9);
    expect(r.rangePenetration).toBe(0.25); // (90k-80k)/(120k-80k)
    expect(r.decisionCode).toBe('APPROVED');
  });

  it('CONDITIONAL below band minimum (warning, requires approval)', () => {
    const r = evaluateOfferCompensation(input({ proposedSalary: 70_000 }));
    expect(r.decisionCode).toBe('CONDITIONAL');
    expect(r.violations.map((v) => v.code)).toContain('BELOW_BAND_MINIMUM');
  });

  it('CONDITIONAL above band maximum', () => {
    const r = evaluateOfferCompensation(input({ proposedSalary: 130_000 }));
    expect(r.decisionCode).toBe('CONDITIONAL');
    expect(r.violations.map((v) => v.code)).toContain('ABOVE_BAND_MAXIMUM');
  });

  it('REJECTED below statutory minimum (blocking outranks band warnings)', () => {
    const r = evaluateOfferCompensation(input({ proposedSalary: 60_000, statutoryMinimum: 65_000 }));
    expect(r.decisionCode).toBe('REJECTED');
    expect(r.violations.map((v) => v.code)).toContain('BELOW_STATUTORY_MINIMUM');
  });

  it('REJECTED on currency mismatch', () => {
    const r = evaluateOfferCompensation(input({ currency: 'EUR' }));
    expect(r.decisionCode).toBe('REJECTED');
    expect(r.violations.map((v) => v.code)).toContain('CURRENCY_MISMATCH');
  });

  it('REJECTED on invalid (non-monotonic) band', () => {
    const r = evaluateOfferCompensation(input({ band: { minSalary: 120_000, midSalary: 100_000, maxSalary: 80_000 } }));
    expect(r.decisionCode).toBe('REJECTED');
    expect(r.violations.map((v) => v.code)).toContain('INVALID_BAND');
  });

  it('CONDITIONAL when pay-equity deviation exceeds threshold', () => {
    const r = evaluateOfferCompensation(input({ proposedSalary: 119_000, payEquity: { comparableMedian: 100_000, maxDeviationPct: 0.1 } }));
    expect(r.decisionCode).toBe('CONDITIONAL');
    expect(r.violations.map((v) => v.code)).toContain('PAY_EQUITY_DEVIATION');
  });

  it('APPROVED when pay-equity deviation within threshold', () => {
    const r = evaluateOfferCompensation(input({ proposedSalary: 105_000, payEquity: { comparableMedian: 100_000, maxDeviationPct: 0.1 } }));
    expect(r.decisionCode).toBe('APPROVED');
  });
});
