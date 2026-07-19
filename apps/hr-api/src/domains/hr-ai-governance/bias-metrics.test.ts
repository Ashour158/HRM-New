import { describe, expect, it } from 'vitest';
import { ValidationError } from '@hcm/shared-kernel';
import { computeAdverseImpactBiasTest, FOUR_FIFTHS_THRESHOLD, type BiasTestGroupOutcome } from './bias-metrics.js';
import { SUPPRESSED } from '../dei-analytics/aggregates/k-anonymity.js';

describe('computeAdverseImpactBiasTest', () => {
  it('PASSED: a clearly-fair outcome distribution (ratio well above the four-fifths threshold)', () => {
    const outcomeData: BiasTestGroupOutcome[] = [
      { group: 'group_a', selected: 48, totalConsidered: 100 },
      { group: 'group_b', selected: 45, totalConsidered: 100 },
    ];
    const r = computeAdverseImpactBiasTest(outcomeData);
    expect(r.decisionCode).toBe('PASSED');
    expect(r.passed).toBe(true);
    expect(r.referenceGroup).toBe('group_a');
    expect(r.referenceSelectionRate).toBe(0.48);
    const groupB = r.groups.find((g) => g.group === 'group_b');
    expect(groupB).toMatchObject({ adverseImpact: false });
    if (!groupB || groupB.suppressed) throw new Error('expected eligible group_b');
    expect(groupB.impactRatio).toBeCloseTo(45 / 48, 4);
  });

  it('FAILED: a clearly-biased outcome distribution (ratio well below the four-fifths threshold)', () => {
    const outcomeData: BiasTestGroupOutcome[] = [
      { group: 'group_a', selected: 80, totalConsidered: 100 },
      { group: 'group_b', selected: 30, totalConsidered: 100 },
    ];
    const r = computeAdverseImpactBiasTest(outcomeData);
    expect(r.decisionCode).toBe('FAILED');
    expect(r.passed).toBe(false);
    const groupB = r.groups.find((g) => g.group === 'group_b');
    if (!groupB || groupB.suppressed) throw new Error('expected eligible group_b');
    expect(groupB.impactRatio).toBeCloseTo(0.375, 3); // 30/100 / 80/100
    expect(groupB.adverseImpact).toBe(true);
  });

  it('is exactly at the boundary: a ratio of precisely 0.8 does not fail (threshold is a floor, not exclusive)', () => {
    const outcomeData: BiasTestGroupOutcome[] = [
      { group: 'group_a', selected: 100, totalConsidered: 100 },
      { group: 'group_b', selected: 80, totalConsidered: 100 },
    ];
    const r = computeAdverseImpactBiasTest(outcomeData);
    expect(r.decisionCode).toBe('PASSED');
  });

  it('suppresses small subgroups rather than exposing or flagging them on insufficient data', () => {
    const outcomeData: BiasTestGroupOutcome[] = [
      { group: 'group_a', selected: 90, totalConsidered: 100 },
      { group: 'group_b', selected: 60, totalConsidered: 100 },
      { group: 'tiny_group', selected: 1, totalConsidered: 3 }, // below default aggregation threshold of 5
    ];
    const r = computeAdverseImpactBiasTest(outcomeData);

    // The small group must not appear with its raw counts, and must not be
    // usable to flag/clear bias — it is excluded from the determination.
    const tiny = r.groups.find((g) => g.group === 'tiny_group');
    expect(tiny).toBeDefined();
    expect(tiny?.suppressed).toBe(true);
    expect(tiny?.totalConsidered).toBe(SUPPRESSED);
    expect('selected' in (tiny as object)).toBe(false);
    expect('selectionRate' in (tiny as object)).toBe(false);
    expect(r.suppressedGroups).toContain('tiny_group');

    // The determination itself is still made from the two eligible groups.
    expect(r.decisionCode).toBe('FAILED');
    expect(r.referenceGroup).toBe('group_a');
  });

  it('REQUIRES_REVIEW when fewer than two groups meet the aggregation threshold', () => {
    const outcomeData: BiasTestGroupOutcome[] = [
      { group: 'group_a', selected: 90, totalConsidered: 100 },
      { group: 'tiny_group', selected: 1, totalConsidered: 2 },
    ];
    const r = computeAdverseImpactBiasTest(outcomeData);
    expect(r.decisionCode).toBe('REQUIRES_REVIEW');
    expect(r.passed).toBe(false);
    expect(r.summary).toMatch(/at least two groups/i);
  });

  it('REQUIRES_REVIEW when every group falls below the aggregation threshold', () => {
    const outcomeData: BiasTestGroupOutcome[] = [
      { group: 'group_a', selected: 1, totalConsidered: 2 },
      { group: 'group_b', selected: 0, totalConsidered: 3 },
    ];
    const r = computeAdverseImpactBiasTest(outcomeData);
    expect(r.decisionCode).toBe('REQUIRES_REVIEW');
    expect(r.suppressedGroups.sort()).toEqual(['group_a', 'group_b']);
  });

  it('REQUIRES_REVIEW when no group with sufficient data has any favorable outcome', () => {
    const outcomeData: BiasTestGroupOutcome[] = [
      { group: 'group_a', selected: 0, totalConsidered: 100 },
      { group: 'group_b', selected: 0, totalConsidered: 100 },
    ];
    const r = computeAdverseImpactBiasTest(outcomeData);
    expect(r.decisionCode).toBe('REQUIRES_REVIEW');
    expect(r.summary).toMatch(/no favorable outcomes/i);
  });

  it('honors a custom impact ratio threshold', () => {
    const outcomeData: BiasTestGroupOutcome[] = [
      { group: 'group_a', selected: 80, totalConsidered: 100 },
      { group: 'group_b', selected: 60, totalConsidered: 100 },
    ];
    const strict = computeAdverseImpactBiasTest(outcomeData, { impactRatioThreshold: 0.9 });
    expect(strict.decisionCode).toBe('FAILED');

    const lenient = computeAdverseImpactBiasTest(outcomeData, { impactRatioThreshold: 0.5 });
    expect(lenient.decisionCode).toBe('PASSED');
  });

  it('honors a custom aggregation (suppression) threshold', () => {
    const outcomeData: BiasTestGroupOutcome[] = [
      { group: 'group_a', selected: 8, totalConsidered: 10 },
      { group: 'group_b', selected: 4, totalConsidered: 6 },
    ];
    // Both groups clear the default threshold (5).
    const withDefaultThreshold = computeAdverseImpactBiasTest(outcomeData);
    expect(withDefaultThreshold.suppressedGroups).toEqual([]);

    // A stricter, caller-configured threshold suppresses the smaller group.
    const withStrictThreshold = computeAdverseImpactBiasTest(outcomeData, { aggregationThreshold: 8 });
    expect(withStrictThreshold.suppressedGroups).toContain('group_b');
  });

  it('defaults the impact ratio threshold to the standard four-fifths (0.8) rule', () => {
    expect(FOUR_FIFTHS_THRESHOLD).toBe(0.8);
    const outcomeData: BiasTestGroupOutcome[] = [
      { group: 'group_a', selected: 80, totalConsidered: 100 },
      { group: 'group_b', selected: 79, totalConsidered: 100 },
    ];
    const r = computeAdverseImpactBiasTest(outcomeData);
    expect(r.impactRatioThreshold).toBe(0.8);
  });

  it('rejects empty outcome data', () => {
    expect(() => computeAdverseImpactBiasTest([])).toThrow(ValidationError);
  });

  it('rejects a group where selected exceeds totalConsidered', () => {
    expect(() => computeAdverseImpactBiasTest([
      { group: 'group_a', selected: 10, totalConsidered: 5 },
      { group: 'group_b', selected: 1, totalConsidered: 5 },
    ])).toThrow(ValidationError);
  });

  it('rejects negative counts', () => {
    expect(() => computeAdverseImpactBiasTest([
      { group: 'group_a', selected: -1, totalConsidered: 5 },
      { group: 'group_b', selected: 1, totalConsidered: 5 },
    ])).toThrow(ValidationError);
  });

  it('rejects duplicate group labels', () => {
    expect(() => computeAdverseImpactBiasTest([
      { group: 'group_a', selected: 1, totalConsidered: 5 },
      { group: 'group_a', selected: 2, totalConsidered: 5 },
    ])).toThrow(ValidationError);
  });

  it('rejects an out-of-range impact ratio threshold', () => {
    expect(() => computeAdverseImpactBiasTest([
      { group: 'group_a', selected: 1, totalConsidered: 5 },
      { group: 'group_b', selected: 1, totalConsidered: 5 },
    ], { impactRatioThreshold: 1.5 })).toThrow(ValidationError);
  });
});
