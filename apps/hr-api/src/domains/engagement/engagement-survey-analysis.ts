/**
 * Deterministic engagement-survey analysis.
 *
 * Replaces the previous no-op `analyze()` (which only flipped status CLOSED→ANALYZED)
 * with real computation over the collected responses: response count, per-question and
 * overall average scores, a score distribution, and an eNPS figure when an NPS-style
 * 0–10 question is present.
 *
 * k-anonymity: if the number of responses is below {@link ANONYMITY_THRESHOLD}, the
 * detailed results are SUPPRESSED so a small group cannot be deanonymised — only the
 * (already non-identifying) response count and the suppression flag are returned.
 */

export const ANONYMITY_THRESHOLD = 5;

export interface QuestionStat {
  readonly questionId: string;
  readonly average: number;
  readonly count: number;
}

export interface EngagementSurveyAnalysis {
  readonly responseCount: number;
  readonly suppressed: boolean;
  readonly overallAverage?: number;
  readonly questionStats?: QuestionStat[];
  readonly distribution?: Record<string, number>;
  readonly enps?: number;
}

function numericAnswer(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return undefined;
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * @param responses each response's `responses` map (questionId → answer)
 * @param options.npsQuestionId optional id of a 0–10 NPS question to compute eNPS from
 */
export function analyzeEngagementSurvey(
  responses: Array<Record<string, unknown>>,
  options: { threshold?: number; npsQuestionId?: string } = {},
): EngagementSurveyAnalysis {
  const threshold = options.threshold ?? ANONYMITY_THRESHOLD;
  const responseCount = responses.length;

  if (responseCount < threshold) {
    // Below the anonymity threshold — never expose per-question or distribution data.
    return { responseCount, suppressed: true };
  }

  const sums = new Map<string, { total: number; count: number }>();
  const distribution: Record<string, number> = {};
  const npsValues: number[] = [];

  for (const response of responses) {
    for (const [questionId, raw] of Object.entries(response)) {
      const value = numericAnswer(raw);
      if (value === undefined) continue;
      const agg = sums.get(questionId) ?? { total: 0, count: 0 };
      agg.total += value;
      agg.count += 1;
      sums.set(questionId, agg);
      const bucket = String(value);
      distribution[bucket] = (distribution[bucket] ?? 0) + 1;
      if (options.npsQuestionId && questionId === options.npsQuestionId) {
        npsValues.push(value);
      }
    }
  }

  const questionStats: QuestionStat[] = [...sums.entries()].map(([questionId, { total, count }]) => ({
    questionId,
    average: round(total / count),
    count,
  }));

  const overallTotals = [...sums.values()].reduce(
    (acc, { total, count }) => ({ total: acc.total + total, count: acc.count + count }),
    { total: 0, count: 0 },
  );
  const overallAverage = overallTotals.count > 0 ? round(overallTotals.total / overallTotals.count) : undefined;

  let enps: number | undefined;
  if (npsValues.length > 0) {
    const promoters = npsValues.filter((v) => v >= 9).length;
    const detractors = npsValues.filter((v) => v <= 6).length;
    enps = round(((promoters - detractors) / npsValues.length) * 100, 1);
  }

  return {
    responseCount,
    suppressed: false,
    overallAverage,
    questionStats,
    distribution,
    enps,
  };
}
