import { describe, expect, it } from 'vitest';
import { analyzeEngagementSurvey, ANONYMITY_THRESHOLD } from './engagement-survey-analysis.js';

function responses(n: number, value: number): Array<Record<string, unknown>> {
  return Array.from({ length: n }, () => ({ q1: value, q2: value }));
}

describe('analyzeEngagementSurvey', () => {
  it('suppresses results below the anonymity threshold', () => {
    const r = analyzeEngagementSurvey(responses(ANONYMITY_THRESHOLD - 1, 4));
    expect(r.suppressed).toBe(true);
    expect(r.questionStats).toBeUndefined();
    expect(r.overallAverage).toBeUndefined();
    expect(r.responseCount).toBe(ANONYMITY_THRESHOLD - 1);
  });

  it('computes per-question and overall averages at/above threshold', () => {
    const r = analyzeEngagementSurvey([
      { q1: 4, q2: 2 },
      { q1: 5, q2: 3 },
      { q1: 3, q2: 1 },
      { q1: 4, q2: 2 },
      { q1: 4, q2: 2 },
    ]);
    expect(r.suppressed).toBe(false);
    expect(r.responseCount).toBe(5);
    const q1 = r.questionStats?.find((q) => q.questionId === 'q1');
    expect(q1?.average).toBe(4);
    expect(r.overallAverage).toBeGreaterThan(0);
  });

  it('ignores non-numeric answers', () => {
    const r = analyzeEngagementSurvey([
      { q1: 5, comment: 'great' },
      { q1: 5, comment: 'good' },
      { q1: 5, comment: 'ok' },
      { q1: 5, comment: 'fine' },
      { q1: 5, comment: 'meh' },
    ]);
    const q1 = r.questionStats?.find((q) => q.questionId === 'q1');
    expect(q1?.average).toBe(5);
    expect(r.questionStats?.some((q) => q.questionId === 'comment')).toBe(false);
  });

  it('computes eNPS from an NPS question', () => {
    // 3 promoters (>=9), 1 passive (7-8), 1 detractor (<=6) over 5 responses → (3-1)/5*100 = 40
    const r = analyzeEngagementSurvey(
      [{ nps: 10 }, { nps: 9 }, { nps: 9 }, { nps: 7 }, { nps: 3 }],
      { npsQuestionId: 'nps' },
    );
    expect(r.enps).toBe(40);
  });
});
