import { describe, expect, it } from 'vitest';
import { evaluateDeiPayTransparency, type DeiPayTransparencyInput } from './dei-pay-transparency.engine.js';

function input(overrides: Partial<DeiPayTransparencyInput> = {}): DeiPayTransparencyInput {
  return {
    reportType: 'GENDER_PAY_GAP',
    meanHourlyGapPct: 2,
    medianHourlyGapPct: 1.5,
    totalWorkersIncluded: 80,
    aggregationThreshold: 5,
    // Every quartile/group cell is >= the aggregation threshold (5), so a
    // real, correctly-suppressed report has nothing left to flag.
    quartileDistribution: {
      quartiles: {
        Q1: { count: 20, byGroup: { MALE: { count: 12 }, FEMALE: { count: 8 } } },
        Q2: { count: 20, byGroup: { MALE: { count: 10 }, FEMALE: { count: 10 } } },
        Q3: { count: 20, byGroup: { MALE: { count: 14 }, FEMALE: { count: 6 } } },
        Q4: { count: 20, byGroup: { MALE: { count: 15 }, FEMALE: { count: 5 } } },
      },
    },
    ...overrides,
  };
}

describe('evaluateDeiPayTransparency', () => {
  it('is COMPLIANT for a well-sampled, suppressed, low-materiality report', () => {
    const r = evaluateDeiPayTransparency(input());
    expect(r.decisionCode).toBe('COMPLIANT');
    expect(r.violations).toHaveLength(0);
  });

  it('is NON_COMPLIANT when the sample is smaller than the aggregation threshold', () => {
    const r = evaluateDeiPayTransparency(input({ totalWorkersIncluded: 3 }));
    expect(r.decisionCode).toBe('NON_COMPLIANT');
    expect(r.violations.map((v) => v.code)).toContain('INSUFFICIENT_SAMPLE_SIZE');
  });

  it('is NON_COMPLIANT when the quartile distribution is missing', () => {
    const r = evaluateDeiPayTransparency(input({ quartileDistribution: {} }));
    expect(r.decisionCode).toBe('NON_COMPLIANT');
    expect(r.violations.map((v) => v.code)).toContain('MISSING_QUARTILE_DISTRIBUTION');
  });

  it('is NON_COMPLIANT when a small cell was not suppressed', () => {
    const r = evaluateDeiPayTransparency(
      input({
        quartileDistribution: {
          quartiles: { Q1: { count: 10, byGroup: { MALE: { count: 8 }, FEMALE: { count: 2 } } } },
        },
      }),
    );
    expect(r.decisionCode).toBe('NON_COMPLIANT');
    expect(r.violations.map((v) => v.code)).toContain('UNSUPPRESSED_SMALL_CELL');
  });

  it('does not flag an already-suppressed cell (non-numeric sentinel)', () => {
    const r = evaluateDeiPayTransparency(
      input({
        quartileDistribution: {
          quartiles: { Q1: { count: 10, byGroup: { MALE: { count: 8 }, FEMALE: { count: 'SUPPRESSED' } } } },
        },
      }),
    );
    expect(r.violations.map((v) => v.code)).not.toContain('UNSUPPRESSED_SMALL_CELL');
  });

  it('is REQUIRES_REVIEW when the mean or median gap exceeds the materiality threshold', () => {
    const r = evaluateDeiPayTransparency(input({ meanHourlyGapPct: 12 }));
    expect(r.decisionCode).toBe('REQUIRES_REVIEW');
    expect(r.violations.map((v) => v.code)).toContain('MEAN_GAP_EXCEEDS_MATERIALITY_THRESHOLD');
  });

  it('respects a custom materiality threshold', () => {
    const r = evaluateDeiPayTransparency(input({ meanHourlyGapPct: 6, materialityThresholdPct: 10 }));
    expect(r.decisionCode).toBe('COMPLIANT');
  });

  it('NON_COMPLIANT (blocking) outranks a materiality warning', () => {
    const r = evaluateDeiPayTransparency(input({ totalWorkersIncluded: 1, meanHourlyGapPct: 12 }));
    expect(r.decisionCode).toBe('NON_COMPLIANT');
    expect(r.violations.map((v) => v.code)).toEqual(
      expect.arrayContaining(['INSUFFICIENT_SAMPLE_SIZE', 'MEAN_GAP_EXCEEDS_MATERIALITY_THRESHOLD']),
    );
  });
});
