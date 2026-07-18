import { describe, expect, it } from 'vitest';
import { evaluateHrAiGovernanceBiasAudit, type HrAiGovernanceBiasAuditInput } from './hr-ai-governance.engine.js';

function input(overrides: Partial<HrAiGovernanceBiasAuditInput> = {}): HrAiGovernanceBiasAuditInput {
  return { useCaseId: 'uc-1', groups: [], ...overrides };
}

describe('evaluateHrAiGovernanceBiasAudit', () => {
  it('APPROVED when selection rates are close across groups', () => {
    const r = evaluateHrAiGovernanceBiasAudit(input({
      groups: [
        { group: 'group_a', selected: 48, totalConsidered: 100 },
        { group: 'group_b', selected: 45, totalConsidered: 100 },
      ],
    }));
    expect(r.decisionCode).toBe('APPROVED');
    expect(r.referenceGroup).toBe('group_a');
  });

  it('REJECTED when a group falls below the four-fifths threshold', () => {
    const r = evaluateHrAiGovernanceBiasAudit(input({
      groups: [
        { group: 'group_a', selected: 80, totalConsidered: 100 },
        { group: 'group_b', selected: 30, totalConsidered: 100 },
      ],
    }));
    expect(r.decisionCode).toBe('REJECTED');
    const flagged = r.groups.find((g) => g.group === 'group_b');
    expect(flagged?.adverseImpact).toBe(true);
  });

  it('REQUIRES_REVIEW when fewer than two groups meet the minimum sample size', () => {
    const r = evaluateHrAiGovernanceBiasAudit(input({
      groups: [
        { group: 'group_a', selected: 3, totalConsidered: 4 },
        { group: 'group_b', selected: 50, totalConsidered: 100 },
      ],
    }));
    expect(r.decisionCode).toBe('REQUIRES_REVIEW');
    expect(r.groups.find((g) => g.group === 'group_a')?.excludedForSmallSample).toBe(true);
  });

  it('respects a custom impact ratio threshold', () => {
    const r = evaluateHrAiGovernanceBiasAudit(input({
      groups: [
        { group: 'group_a', selected: 80, totalConsidered: 100 },
        { group: 'group_b', selected: 60, totalConsidered: 100 },
      ],
      impactRatioThreshold: 0.5,
    }));
    expect(r.decisionCode).toBe('APPROVED');
  });
});
