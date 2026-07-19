import { randomUUID } from 'node:crypto';
import { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from '../core/decision-record.js';
import type { EngineContext, PolicyEngine, PolicyEngineDefinition } from '../core/engine-definition.js';

/**
 * Recruiting Fairness & Compliance Engine — adverse-impact ("4/5ths rule")
 * analysis of a job requisition's candidate funnel, per EEOC Uniform Guidelines
 * on Employee Selection Procedures (29 CFR 1607.4(D)).
 *
 * Replaces the previous metadata-only `recruiting-fairness-compliance`
 * registration that had no execute() — recruiting funnels (requisition →
 * candidate → interview → offer) had no fairness/compliance dimension at all.
 *
 * SCOPE (this pass):
 *  - Selection-rate adverse-impact screening across funnel stages
 *    (e.g. applied→interviewed, interviewed→offered), compared across
 *    voluntary, self-identified EEO demographic groups.
 *  - A group's selection rate below 80% (4/5ths) of the highest-selection-rate
 *    group's rate is flagged as a potential adverse-impact SIGNAL requiring
 *    human compliance review — this engine never asserts a definitive legal
 *    non-compliance finding on its own (courts require additional analysis:
 *    statistical significance, business necessity, less-discriminatory
 *    alternatives). Hence the only decision codes emitted are COMPLIANT and
 *    REQUIRES_REVIEW.
 *  - Groups with fewer than `smallCellThreshold` (default 5) candidates
 *    considered at a stage are marked `insufficientData` and excluded from
 *    rate/benchmark computation entirely — both because tiny samples are not
 *    statistically reliable (EEOC guidance) and to avoid exposing small-group
 *    outcomes. Callers persisting/serializing this result MUST additionally
 *    run the raw counts through the platform's k-anonymity suppression
 *    utility (`applyKAnonymitySuppression` in the dei-analytics domain) —
 *    this engine stays free of I/O and app-layer concerns, so it cannot do
 *    that itself, but its output is shaped (`{ count }` wrappers) so that
 *    utility applies to it without modification.
 *
 * OUT OF SCOPE (this pass, tracked separately):
 *  - Offer/pay-equity analysis (see the `offer-compensation` engine).
 *  - Full EEOC EEO-1/VETS-4212 report generation.
 *  - Statistical-significance testing (e.g. two-standard-deviations rule) —
 *    the 4/5ths rule alone is a screening heuristic, not a substitute.
 *
 * Pure + deterministic; no I/O.
 */
export type RecruitingFairnessDecisionCode = 'COMPLIANT' | 'REQUIRES_REVIEW';

/**
 * Voluntary EEO self-identification dimensions a funnel can be analyzed
 * across. Each is a legally protected characteristic under U.S. EEO law.
 */
export type EeoDemographicDimension =
  | 'RACE_ETHNICITY'
  | 'GENDER_IDENTITY'
  | 'VETERAN_STATUS'
  | 'DISABILITY_STATUS';

/** Matches the platform's DEI k-anonymity default (see dei-analytics/aggregates/k-anonymity.ts). */
export const DEFAULT_SMALL_CELL_THRESHOLD = 5;

/** The EEOC Uniform Guidelines "4/5ths rule" threshold. */
const FOUR_FIFTHS_THRESHOLD = 0.8;

export interface FunnelStageGroupCounts {
  /** Self-identified demographic group label, e.g. 'FEMALE', 'VETERAN'. */
  readonly group: string;
  /** Candidates who entered/were considered at this stage (denominator). */
  readonly consideredCount: number;
  /** Candidates who advanced out of this stage (numerator). */
  readonly advancedCount: number;
}

export interface FunnelStageInput {
  /** Human-readable stage label, e.g. 'APPLIED_TO_INTERVIEWED'. */
  readonly stageName: string;
  readonly groups: FunnelStageGroupCounts[];
}

export interface AdverseImpactAnalysisInput {
  readonly requisitionId: string;
  readonly dimension: EeoDemographicDimension;
  readonly stages: FunnelStageInput[];
  /** Minimum group size to be included in rate/benchmark comparison. Default 5. */
  readonly smallCellThreshold?: number;
}

export interface FunnelStageGroupResult {
  readonly group: string;
  readonly consideredCount: number;
  readonly advancedCount: number;
  /** True when consideredCount < smallCellThreshold; excluded from comparison. */
  readonly insufficientData: boolean;
  /** advancedCount / consideredCount, rounded to 4dp. Undefined when insufficientData or consideredCount is 0. */
  readonly selectionRate?: number;
  /** selectionRate / benchmarkSelectionRate, rounded to 4dp. Undefined unless a valid comparison could be made. */
  readonly impactRatio?: number;
  /** True when impactRatio < 0.8 (the 4/5ths rule). */
  readonly adverseImpactFlag: boolean;
}

export interface FunnelStageResult {
  readonly stageName: string;
  /** The group with the highest selection rate among groups with sufficient data. */
  readonly benchmarkGroup?: string;
  readonly benchmarkSelectionRate?: number;
  readonly groups: FunnelStageGroupResult[];
  readonly flaggedGroups: string[];
  /** True when at least 2 groups had sufficient data to compare. */
  readonly sufficientDataForComparison: boolean;
}

export interface AdverseImpactAnalysisResult {
  readonly decisionCode: RecruitingFairnessDecisionCode;
  readonly dimension: EeoDemographicDimension;
  readonly stages: FunnelStageResult[];
  readonly flaggedStageCount: number;
  readonly smallCellThreshold: number;
}

function round(value: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/**
 * Evaluate the 4/5ths rule for a single funnel stage.
 */
export function evaluateFunnelStageAdverseImpact(
  stage: FunnelStageInput,
  smallCellThreshold: number = DEFAULT_SMALL_CELL_THRESHOLD,
): FunnelStageResult {
  const groupStats = stage.groups.map((g) => {
    const insufficientData = g.consideredCount < smallCellThreshold;
    const selectionRate = g.consideredCount > 0 ? g.advancedCount / g.consideredCount : undefined;
    return { ...g, insufficientData, selectionRate };
  });

  const comparable = groupStats.filter((g) => !g.insufficientData && g.selectionRate !== undefined);
  const sufficientDataForComparison = comparable.length >= 2;

  const benchmarkRate = sufficientDataForComparison
    ? Math.max(...comparable.map((g) => g.selectionRate as number))
    : undefined;
  const benchmarkGroup = benchmarkRate === undefined
    ? undefined
    : comparable.find((g) => g.selectionRate === benchmarkRate)?.group;

  const groups: FunnelStageGroupResult[] = groupStats.map((g) => {
    const canCompare =
      sufficientDataForComparison &&
      !g.insufficientData &&
      g.selectionRate !== undefined &&
      benchmarkRate !== undefined &&
      benchmarkRate > 0;

    if (!canCompare) {
      return {
        group: g.group,
        consideredCount: g.consideredCount,
        advancedCount: g.advancedCount,
        insufficientData: g.insufficientData,
        selectionRate: g.insufficientData || g.selectionRate === undefined ? undefined : round(g.selectionRate),
        adverseImpactFlag: false,
      };
    }

    const impactRatio = round((g.selectionRate as number) / (benchmarkRate as number));
    return {
      group: g.group,
      consideredCount: g.consideredCount,
      advancedCount: g.advancedCount,
      insufficientData: false,
      selectionRate: round(g.selectionRate as number),
      impactRatio,
      adverseImpactFlag: impactRatio < FOUR_FIFTHS_THRESHOLD,
    };
  });

  return {
    stageName: stage.stageName,
    benchmarkGroup,
    benchmarkSelectionRate: benchmarkRate !== undefined ? round(benchmarkRate) : undefined,
    groups,
    flaggedGroups: groups.filter((g) => g.adverseImpactFlag).map((g) => g.group),
    sufficientDataForComparison,
  };
}

/**
 * Evaluate adverse impact across every funnel stage of a requisition for one
 * EEO demographic dimension.
 */
export function evaluateRequisitionAdverseImpact(input: AdverseImpactAnalysisInput): AdverseImpactAnalysisResult {
  const smallCellThreshold = input.smallCellThreshold ?? DEFAULT_SMALL_CELL_THRESHOLD;
  const stages = input.stages.map((stage) => evaluateFunnelStageAdverseImpact(stage, smallCellThreshold));
  const flaggedStageCount = stages.filter((s) => s.flaggedGroups.length > 0).length;
  const decisionCode: RecruitingFairnessDecisionCode = flaggedStageCount > 0 ? 'REQUIRES_REVIEW' : 'COMPLIANT';

  return {
    decisionCode,
    dimension: input.dimension,
    stages,
    flaggedStageCount,
    smallCellThreshold,
  };
}

export class RecruitingFairnessComplianceEngine implements PolicyEngine<AdverseImpactAnalysisInput, DecisionRecord> {
  readonly definition: PolicyEngineDefinition = {
    engineName: 'recruiting-fairness-compliance',
    engineVersion: '1.4.0',
    description:
      'Ensures recruiting workflows comply with diversity, equal-opportunity, '
      + 'and local labor-market regulations. Implements EEOC 4/5ths-rule adverse-impact '
      + 'screening of funnel-stage selection rates across voluntary EEO demographic groups.',
    inputTypes: ['Requisition', 'CandidatePool', 'InterviewPlan'],
    outputDecisionCodes: ['COMPLIANT', 'REQUIRES_REVIEW'],
    associatedRulePacks: ['recruiting-compliance-rules'],
    associatedTables: ['requisitions', 'candidates', 'interviews'],
    invocationPattern: 'ASYNC',
    maxDurationMs: 2000,
    requiresCountryPolicyPack: true,
    requiresHumanReview: true,
    auditRequired: true,
  };

  async execute(input: AdverseImpactAnalysisInput, context: EngineContext): Promise<DecisionRecord> {
    const result = evaluateRequisitionAdverseImpact(input);
    const flaggedSummary = result.stages
      .filter((s) => s.flaggedGroups.length > 0)
      .map((s) => `${s.stageName}: ${s.flaggedGroups.join(', ')}`)
      .join('; ');

    return {
      decisionId: new Uuid(randomUUID()),
      decisionCode: result.decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'recruiting-compliance-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `Adverse-impact (4/5ths rule) screen for requisition ${input.requisitionId} on dimension ${input.dimension}: `
        + `${result.flaggedStageCount} of ${result.stages.length} stage(s) flagged. `
        + `Result: ${result.decisionCode}.`
        + (flaggedSummary ? ` Flagged: ${flaggedSummary}.` : ''),
      sourceInputIds: [],
      inputSnapshotHash: '<SHA-256>',
      timestamp: new Date(),
      tenantId: context.tenantId,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveDate: context.effectiveDate,
      countryCode: context.countryCode,
    };
  }
}
