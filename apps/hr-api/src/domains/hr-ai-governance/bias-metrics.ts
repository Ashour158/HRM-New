/**
 * Deterministic bias-test computation for HR AI/ML use cases.
 *
 * Replaces the previous no-op `CompleteHrAiBiasTest` flow, where a caller simply
 * asserted `passed`/`metrics` and the domain stored the assertion verbatim (pure
 * attestation, zero independent verification). This module computes an actual
 * fairness metric from submitted outcome counts.
 *
 * Metric: four-fifths (adverse impact) ratio — the standard EEOC "4/5ths rule"
 * screen. For each protected-class group we compute a selection rate
 * (favorable outcomes / total considered) and compare it against the group
 * with the highest selection rate. A group whose ratio falls below the
 * configured threshold (0.8 by convention) shows a statistically significant
 * shortfall in favorable outcomes relative to the most-favored group.
 *
 * This is a *statistical screen*, not a legal compliance determination: a
 * ratio below the threshold does not by itself establish unlawful
 * discrimination, and a ratio at/above the threshold does not by itself
 * establish the model is fair. Small subgroups (below the k-anonymity
 * aggregation threshold) lack the statistical power for either conclusion, so
 * they are excluded from the pass/fail determination and their raw counts are
 * suppressed in the stored result — reusing the DEI-analytics k-anonymity
 * utility rather than re-implementing small-cell suppression here (see
 * dei-analytics/aggregates/k-anonymity.ts; `engagement` previously
 * re-implemented this and that duplication is a known anti-pattern).
 */

import { ValidationError } from '@hcm/shared-kernel';
import { applyKAnonymitySuppression, DEFAULT_AGGREGATION_THRESHOLD, SUPPRESSED } from '../dei-analytics/aggregates/k-anonymity.js';

/** Standard four-fifths (80%) adverse-impact-ratio threshold. */
export const FOUR_FIFTHS_THRESHOLD = 0.8;

export type BiasTestDecisionCode = 'PASSED' | 'FAILED' | 'REQUIRES_REVIEW';

/** Raw favorable-outcome counts for a single protected-class group. */
export interface BiasTestGroupOutcome {
  /** Protected-class group label, e.g. 'female', 'age_40_plus'. */
  readonly group: string;
  /** Count of favorable outcomes (selected/advanced/hired/ranked-top) for this group. */
  readonly selected: number;
  /** Total count of candidates/decisions considered for this group. */
  readonly totalConsidered: number;
}

interface BiasTestGroupMetricEligible {
  readonly group: string;
  readonly totalConsidered: number;
  readonly selected: number;
  readonly selectionRate: number;
  readonly impactRatio: number;
  readonly adverseImpact: boolean;
  readonly suppressed: false;
}

interface BiasTestGroupMetricSuppressed {
  readonly group: string;
  readonly totalConsidered: typeof SUPPRESSED;
  readonly suppressed: true;
}

export type BiasTestGroupMetric = BiasTestGroupMetricEligible | BiasTestGroupMetricSuppressed;

export interface BiasTestComputationResult {
  readonly decisionCode: BiasTestDecisionCode;
  /** True only when decisionCode === 'PASSED'; kept for backward-compatible boolean consumers. */
  readonly passed: boolean;
  readonly metricType: 'FOUR_FIFTHS_ADVERSE_IMPACT_RATIO';
  readonly impactRatioThreshold: number;
  readonly aggregationThreshold: number;
  readonly referenceGroup?: string;
  readonly referenceSelectionRate?: number;
  readonly groups: BiasTestGroupMetric[];
  readonly suppressedGroups: string[];
  readonly summary: string;
  readonly computedAt: string;
}

export interface BiasTestComputationOptions {
  /** Minimum acceptable selection-rate ratio vs. the most-favored group (default 0.8, the four-fifths rule). */
  readonly impactRatioThreshold?: number;
  /** Minimum group size required to participate in the determination (default DEFAULT_AGGREGATION_THRESHOLD). */
  readonly aggregationThreshold?: number;
}

function round(value: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function validateOutcomeData(outcomeData: readonly BiasTestGroupOutcome[]): void {
  if (!Array.isArray(outcomeData) || outcomeData.length === 0) {
    throw new ValidationError('Bias test requires at least one group outcome record.');
  }
  const seen = new Set<string>();
  for (const row of outcomeData) {
    if (!row || typeof row.group !== 'string' || !row.group.trim()) {
      throw new ValidationError('Every group outcome record requires a non-empty group label.');
    }
    if (seen.has(row.group)) {
      throw new ValidationError(`Duplicate group label "${row.group}" in bias test outcome data.`);
    }
    seen.add(row.group);
    if (!Number.isFinite(row.totalConsidered) || row.totalConsidered < 0) {
      throw new ValidationError(`Group "${row.group}" has an invalid totalConsidered count.`);
    }
    if (!Number.isFinite(row.selected) || row.selected < 0) {
      throw new ValidationError(`Group "${row.group}" has an invalid selected count.`);
    }
    if (row.selected > row.totalConsidered) {
      throw new ValidationError(`Group "${row.group}" has more selected (${row.selected}) than totalConsidered (${row.totalConsidered}).`);
    }
  }
}

/**
 * Compute the four-fifths adverse-impact ratio bias test over per-group
 * outcome counts. Pure and deterministic; no I/O.
 */
export function computeAdverseImpactBiasTest(
  outcomeData: readonly BiasTestGroupOutcome[],
  options: BiasTestComputationOptions = {},
): BiasTestComputationResult {
  validateOutcomeData(outcomeData);

  const impactRatioThreshold = options.impactRatioThreshold ?? FOUR_FIFTHS_THRESHOLD;
  if (!Number.isFinite(impactRatioThreshold) || impactRatioThreshold <= 0 || impactRatioThreshold > 1) {
    throw new ValidationError('impactRatioThreshold must be a number in the range (0, 1].');
  }
  const aggregationThreshold = options.aggregationThreshold ?? DEFAULT_AGGREGATION_THRESHOLD;
  const computedAt = new Date().toISOString();

  // Reuse the shared k-anonymity utility as the single source of truth for what
  // counts as "too small to report" — do not re-derive the threshold comparison here.
  const suppressionShells = outcomeData.map((row) => ({ group: row.group, count: row.totalConsidered }));
  const suppressionView = applyKAnonymitySuppression(suppressionShells, aggregationThreshold) as Array<{
    group: string;
    count: number | typeof SUPPRESSED;
  }>;
  const suppressedGroupLabels = new Set(
    suppressionView.filter((s) => s.count === SUPPRESSED).map((s) => s.group),
  );

  const eligible = outcomeData.filter((row) => !suppressedGroupLabels.has(row.group));
  const suppressedGroups = outcomeData.filter((row) => suppressedGroupLabels.has(row.group));

  const suppressedMetrics: BiasTestGroupMetric[] = suppressedGroups.map((row) => ({
    group: row.group,
    totalConsidered: SUPPRESSED,
    suppressed: true,
  }));

  if (eligible.length < 2) {
    return {
      decisionCode: 'REQUIRES_REVIEW',
      passed: false,
      metricType: 'FOUR_FIFTHS_ADVERSE_IMPACT_RATIO',
      impactRatioThreshold,
      aggregationThreshold,
      groups: suppressedMetrics,
      suppressedGroups: [...suppressedGroupLabels],
      summary: eligible.length === 0
        ? `All ${outcomeData.length} group(s) fell below the minimum aggregation threshold of ${aggregationThreshold}; insufficient data to compute an adverse impact determination.`
        : `Only one group ("${eligible[0].group}") has sufficient data (>= ${aggregationThreshold}); at least two groups are required to compare selection rates.`,
      computedAt,
    };
  }

  const withRates = eligible.map((row) => ({
    ...row,
    selectionRate: row.totalConsidered > 0 ? row.selected / row.totalConsidered : 0,
  }));

  const referenceRow = withRates.reduce((max, row) => (row.selectionRate > max.selectionRate ? row : max), withRates[0]);

  if (referenceRow.selectionRate === 0) {
    return {
      decisionCode: 'REQUIRES_REVIEW',
      passed: false,
      metricType: 'FOUR_FIFTHS_ADVERSE_IMPACT_RATIO',
      impactRatioThreshold,
      aggregationThreshold,
      groups: [
        ...withRates.map((row) => ({
          group: row.group,
          totalConsidered: row.totalConsidered,
          selected: row.selected,
          selectionRate: round(row.selectionRate),
          impactRatio: 0,
          adverseImpact: false,
          suppressed: false as const,
        })),
        ...suppressedMetrics,
      ],
      suppressedGroups: [...suppressedGroupLabels],
      summary: 'No favorable outcomes were recorded in any group with sufficient data; cannot compute an adverse impact ratio.',
      computedAt,
    };
  }

  const groupMetrics: BiasTestGroupMetricEligible[] = withRates.map((row) => {
    const impactRatio = round(row.selectionRate / referenceRow.selectionRate);
    return {
      group: row.group,
      totalConsidered: row.totalConsidered,
      selected: row.selected,
      selectionRate: round(row.selectionRate),
      impactRatio,
      adverseImpact: row.group !== referenceRow.group && impactRatio < impactRatioThreshold,
      suppressed: false,
    };
  });

  const failingGroups = groupMetrics.filter((g) => g.adverseImpact);
  const decisionCode: BiasTestDecisionCode = failingGroups.length > 0 ? 'FAILED' : 'PASSED';

  const summary = decisionCode === 'PASSED'
    ? `All ${groupMetrics.length} eligible group(s) meet the four-fifths rule (>= ${round(impactRatioThreshold * 100, 1)}% of the reference group "${referenceRow.group}" selection rate of ${round(referenceRow.selectionRate * 100, 1)}%).`
    : `Adverse impact detected for ${failingGroups.map((g) => g.group).join(', ')}: selection-rate ratio below the ${round(impactRatioThreshold * 100, 1)}% four-fifths threshold relative to reference group "${referenceRow.group}" (${round(referenceRow.selectionRate * 100, 1)}% selection rate).`;

  return {
    decisionCode,
    passed: decisionCode === 'PASSED',
    metricType: 'FOUR_FIFTHS_ADVERSE_IMPACT_RATIO',
    impactRatioThreshold,
    aggregationThreshold,
    referenceGroup: referenceRow.group,
    referenceSelectionRate: round(referenceRow.selectionRate),
    groups: [...groupMetrics, ...suppressedMetrics],
    suppressedGroups: [...suppressedGroupLabels],
    summary,
    computedAt,
  };
}
