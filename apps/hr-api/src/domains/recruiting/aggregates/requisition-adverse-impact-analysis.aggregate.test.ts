import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { evaluateRequisitionAdverseImpact, type FunnelStageInput } from '@hcm/policy-engines';
import { SUPPRESSED } from '../../dei-analytics/aggregates/k-anonymity.js';
import { RequisitionAdverseImpactAnalysis } from './requisition-adverse-impact-analysis.aggregate.js';

const tenantId = new Uuid('00000000-0000-4000-8000-000000000001');
const requisitionId = new Uuid('00000000-0000-4000-8000-000000000002');
const analysisId = new Uuid('00000000-0000-4000-8000-000000000003');
const correlationId = Uuid.generate();

function analyze(stages: FunnelStageInput[], smallCellThreshold = 5) {
  const result = evaluateRequisitionAdverseImpact({
    requisitionId: requisitionId.value,
    dimension: 'GENDER_IDENTITY',
    stages,
    smallCellThreshold,
  });
  return RequisitionAdverseImpactAnalysis.analyze(
    { id: analysisId, tenantId, requisitionId, result },
    correlationId,
  );
}

describe('RequisitionAdverseImpactAnalysis.analyze', () => {
  it('a funnel with no adverse impact passes clean (COMPLIANT, no flagged groups)', () => {
    const analysis = analyze([
      {
        stageName: 'APPLIED_TO_INTERVIEWED',
        groups: [
          { group: 'FEMALE', consideredCount: 50, advancedCount: 42 }, // 84%
          { group: 'MALE', consideredCount: 50, advancedCount: 45 }, // 90%
        ],
      },
    ]);

    expect(analysis.decisionCode).toBe('COMPLIANT');
    expect(analysis.flaggedStageCount).toBe(0);
    expect(analysis.status).toBe('ANALYZED');

    const stages = (analysis.stageResults as any).stages;
    expect(stages[0].flaggedGroups).toEqual([]);
    // Sufficiently-sized groups are never suppressed.
    expect(stages[0].groups.find((g: any) => g.group === 'FEMALE').consideredCount.count).toBe(50);
  });

  it('a funnel with a clear 4/5ths violation is correctly flagged (REQUIRES_REVIEW)', () => {
    const analysis = analyze([
      {
        stageName: 'APPLIED_TO_INTERVIEWED',
        groups: [
          { group: 'FEMALE', consideredCount: 100, advancedCount: 20 }, // 20%
          { group: 'MALE', consideredCount: 100, advancedCount: 50 }, // 50%
        ],
      },
    ]);

    expect(analysis.decisionCode).toBe('REQUIRES_REVIEW');
    expect(analysis.flaggedStageCount).toBe(1);

    const stages = (analysis.stageResults as any).stages;
    expect(stages[0].flaggedGroups).toEqual(['FEMALE']);
    const female = stages[0].groups.find((g: any) => g.group === 'FEMALE');
    expect(female.adverseImpactFlag).toBe(true);
    expect(female.impactRatio).toBe(0.4);
  });

  it('suppresses small groups (<5 candidates) instead of exposing their raw counts', () => {
    const analysis = analyze([
      {
        stageName: 'INTERVIEWED_TO_OFFERED',
        groups: [
          { group: 'NON_BINARY', consideredCount: 3, advancedCount: 1 }, // below threshold
          { group: 'MALE', consideredCount: 40, advancedCount: 32 },
          { group: 'FEMALE', consideredCount: 40, advancedCount: 30 },
        ],
      },
    ]);

    const stages = (analysis.stageResults as any).stages;
    const smallGroup = stages[0].groups.find((g: any) => g.group === 'NON_BINARY');

    // Raw counts for the small cell are suppressed via the shared k-anonymity utility.
    expect(smallGroup.consideredCount.count).toBe(SUPPRESSED);
    expect(smallGroup.advancedCount.count).toBe(SUPPRESSED);
    expect(smallGroup.insufficientData).toBe(true);
    // The engine itself never computed a rate for this group in the first place.
    expect(smallGroup.selectionRate).toBeUndefined();
    expect(smallGroup.adverseImpactFlag).toBe(false);
    expect(stages[0].flaggedGroups).not.toContain('NON_BINARY');

    // Sufficiently-sized groups remain visible.
    const maleGroup = stages[0].groups.find((g: any) => g.group === 'MALE');
    expect(maleGroup.consideredCount.count).toBe(40);
    expect(maleGroup.advancedCount.count).toBe(32);
  });

  it('transitions ANALYZED -> REVIEWED and rejects a second review', () => {
    const analysis = analyze([
      { stageName: 'APPLIED_TO_INTERVIEWED', groups: [{ group: 'FEMALE', consideredCount: 10, advancedCount: 8 }, { group: 'MALE', consideredCount: 10, advancedCount: 8 }] },
    ]);
    const reviewerId = Uuid.generate();

    analysis.review(reviewerId, Uuid.generate(), 'Reviewed, no concerns.');

    expect(analysis.status).toBe('REVIEWED');
    expect(analysis.reviewedBy?.value).toBe(reviewerId.value);
    expect(analysis.reviewNotes).toBe('Reviewed, no concerns.');

    expect(() => analysis.review(Uuid.generate(), Uuid.generate())).toThrow(/Cannot review/);
  });
});
