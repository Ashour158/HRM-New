import { describe, expect, it } from 'vitest';
import {
  evaluateFunnelStageAdverseImpact,
  evaluateRequisitionAdverseImpact,
  type AdverseImpactAnalysisInput,
  type FunnelStageInput,
} from './recruiting-fairness-compliance.engine.js';

describe('evaluateFunnelStageAdverseImpact', () => {
  it('flags no adverse impact when selection rates are close (clean funnel)', () => {
    const stage: FunnelStageInput = {
      stageName: 'APPLIED_TO_INTERVIEWED',
      groups: [
        { group: 'FEMALE', consideredCount: 50, advancedCount: 40 }, // 80%
        { group: 'MALE', consideredCount: 50, advancedCount: 45 }, // 90%
      ],
    };

    const result = evaluateFunnelStageAdverseImpact(stage);

    expect(result.benchmarkGroup).toBe('MALE');
    expect(result.benchmarkSelectionRate).toBe(0.9);
    expect(result.flaggedGroups).toHaveLength(0);
    // 0.8 / 0.9 = 0.8888... >= 0.8 four-fifths threshold
    const female = result.groups.find((g) => g.group === 'FEMALE');
    expect(female?.impactRatio).toBeCloseTo(0.8889, 4);
    expect(female?.adverseImpactFlag).toBe(false);
  });

  it('flags a clear 4/5ths violation', () => {
    const stage: FunnelStageInput = {
      stageName: 'APPLIED_TO_INTERVIEWED',
      groups: [
        { group: 'FEMALE', consideredCount: 100, advancedCount: 20 }, // 20%
        { group: 'MALE', consideredCount: 100, advancedCount: 50 }, // 50%
      ],
    };

    const result = evaluateFunnelStageAdverseImpact(stage);

    expect(result.benchmarkGroup).toBe('MALE');
    expect(result.flaggedGroups).toEqual(['FEMALE']);
    const female = result.groups.find((g) => g.group === 'FEMALE');
    // 0.2 / 0.5 = 0.4, well below the 0.8 threshold
    expect(female?.impactRatio).toBe(0.4);
    expect(female?.adverseImpactFlag).toBe(true);
    const male = result.groups.find((g) => g.group === 'MALE');
    expect(male?.adverseImpactFlag).toBe(false);
  });

  it('excludes small groups (<5 considered) from comparison and never assigns them a rate', () => {
    const stage: FunnelStageInput = {
      stageName: 'INTERVIEWED_TO_OFFERED',
      groups: [
        { group: 'NON_BINARY', consideredCount: 3, advancedCount: 0 }, // tiny group, 0%
        { group: 'MALE', consideredCount: 40, advancedCount: 32 }, // 80%
        { group: 'FEMALE', consideredCount: 40, advancedCount: 30 }, // 75%
      ],
    };

    const result = evaluateFunnelStageAdverseImpact(stage, 5);

    const smallGroup = result.groups.find((g) => g.group === 'NON_BINARY');
    expect(smallGroup?.insufficientData).toBe(true);
    expect(smallGroup?.selectionRate).toBeUndefined();
    expect(smallGroup?.impactRatio).toBeUndefined();
    expect(smallGroup?.adverseImpactFlag).toBe(false);
    expect(result.flaggedGroups).not.toContain('NON_BINARY');
    // Benchmark must be computed only from the two groups with sufficient data.
    expect(result.benchmarkGroup).toBe('MALE');
    expect(result.sufficientDataForComparison).toBe(true);
  });

  it('reports insufficient data for comparison when fewer than 2 groups qualify', () => {
    const stage: FunnelStageInput = {
      stageName: 'APPLIED_TO_INTERVIEWED',
      groups: [
        { group: 'FEMALE', consideredCount: 2, advancedCount: 1 },
        { group: 'MALE', consideredCount: 50, advancedCount: 40 },
      ],
    };

    const result = evaluateFunnelStageAdverseImpact(stage, 5);

    expect(result.sufficientDataForComparison).toBe(false);
    expect(result.benchmarkGroup).toBeUndefined();
    expect(result.flaggedGroups).toHaveLength(0);
    // Even the sufficiently-sized group gets no rate/flag since there's nothing to compare against.
    const male = result.groups.find((g) => g.group === 'MALE');
    expect(male?.selectionRate).toBe(0.8);
    expect(male?.impactRatio).toBeUndefined();
    expect(male?.adverseImpactFlag).toBe(false);
  });
});

describe('evaluateRequisitionAdverseImpact', () => {
  function input(overrides: Partial<AdverseImpactAnalysisInput> = {}): AdverseImpactAnalysisInput {
    return {
      requisitionId: '11111111-1111-1111-1111-111111111111',
      dimension: 'GENDER_IDENTITY',
      stages: [
        {
          stageName: 'APPLIED_TO_INTERVIEWED',
          groups: [
            { group: 'FEMALE', consideredCount: 50, advancedCount: 40 },
            { group: 'MALE', consideredCount: 50, advancedCount: 45 },
          ],
        },
      ],
      ...overrides,
    };
  }

  it('returns COMPLIANT when no stage is flagged', () => {
    const result = evaluateRequisitionAdverseImpact(input());
    expect(result.decisionCode).toBe('COMPLIANT');
    expect(result.flaggedStageCount).toBe(0);
  });

  it('returns REQUIRES_REVIEW (never NON_COMPLIANT) when any stage is flagged', () => {
    const result = evaluateRequisitionAdverseImpact(input({
      stages: [
        {
          stageName: 'APPLIED_TO_INTERVIEWED',
          groups: [
            { group: 'FEMALE', consideredCount: 100, advancedCount: 20 },
            { group: 'MALE', consideredCount: 100, advancedCount: 50 },
          ],
        },
      ],
    }));
    expect(result.decisionCode).toBe('REQUIRES_REVIEW');
    expect(result.flaggedStageCount).toBe(1);
  });

  it('defaults the small-cell threshold to 5, matching the platform k-anonymity default', () => {
    const result = evaluateRequisitionAdverseImpact(input());
    expect(result.smallCellThreshold).toBe(5);
  });
});
