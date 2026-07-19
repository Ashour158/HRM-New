import { randomUUID } from 'node:crypto';
import { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from '../core/decision-record.js';
import type { EngineContext, PolicyEngine, PolicyEngineDefinition } from '../core/engine-definition.js';

/**
 * HR AI Governance Engine — computes the four-fifths (adverse impact ratio)
 * bias screen for an AI/ML use case's outcome data, broken down by
 * protected-class group.
 *
 * Replaces the previous metadata-only `hr-ai-governance` registration that had
 * no execute() — bias audits were attestation-only, the caller simply asserted
 * a `passed` boolean and it was stored verbatim. Pure + deterministic; no I/O.
 *
 * This package cannot depend on `apps/hr-api` (dependencies only flow from
 * apps to packages), so the ratio computation here is a small, self-contained
 * mirror of the authoritative implementation in
 * `apps/hr-api/src/domains/hr-ai-governance/bias-metrics.ts`, which is what the
 * live `CompleteHrAiBiasTest` command handler actually runs. Both apply the
 * same four-fifths methodology and the same "exclude/don't flag on small
 * subgroups" caution; keep them in sync if the methodology changes.
 */
export type HrAiGovernanceDecisionCode = 'APPROVED' | 'REJECTED' | 'REQUIRES_REVIEW';

export interface HrAiGovernanceGroupOutcome {
  readonly group: string;
  readonly selected: number;
  readonly totalConsidered: number;
}

export interface HrAiGovernanceBiasAuditInput {
  readonly useCaseId: string;
  readonly groups: HrAiGovernanceGroupOutcome[];
  /** Minimum acceptable selection-rate ratio vs. the most-favored group (default 0.8, the four-fifths rule). */
  readonly impactRatioThreshold?: number;
  /** Minimum group size required to participate in the determination (default 5). */
  readonly minimumGroupSize?: number;
}

export interface HrAiGovernanceGroupResult {
  readonly group: string;
  readonly selectionRate?: number;
  readonly impactRatio?: number;
  readonly adverseImpact?: boolean;
  readonly excludedForSmallSample: boolean;
}

export interface HrAiGovernanceBiasAuditResult {
  readonly decisionCode: HrAiGovernanceDecisionCode;
  readonly referenceGroup?: string;
  readonly groups: HrAiGovernanceGroupResult[];
  readonly explanation: string;
}

const DEFAULT_IMPACT_RATIO_THRESHOLD = 0.8;
const DEFAULT_MINIMUM_GROUP_SIZE = 5;

function round(value: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/**
 * Deterministically evaluate the four-fifths adverse-impact ratio over
 * per-group outcome counts. Groups below `minimumGroupSize` are excluded from
 * the determination (insufficient statistical power) rather than flagged.
 */
export function evaluateHrAiGovernanceBiasAudit(input: HrAiGovernanceBiasAuditInput): HrAiGovernanceBiasAuditResult {
  const impactRatioThreshold = input.impactRatioThreshold ?? DEFAULT_IMPACT_RATIO_THRESHOLD;
  const minimumGroupSize = input.minimumGroupSize ?? DEFAULT_MINIMUM_GROUP_SIZE;
  const groups = input.groups ?? [];

  const eligible = groups.filter((g) => g.totalConsidered >= minimumGroupSize);
  const excluded = groups.filter((g) => g.totalConsidered < minimumGroupSize);
  const excludedResults: HrAiGovernanceGroupResult[] = excluded.map((g) => ({ group: g.group, excludedForSmallSample: true }));

  if (eligible.length < 2) {
    return {
      decisionCode: 'REQUIRES_REVIEW',
      groups: excludedResults,
      explanation: `Only ${eligible.length} group(s) meet the minimum sample size of ${minimumGroupSize}; at least two are required to compute an adverse-impact ratio. This is a statistical screen, not a compliance certification — route to human review.`,
    };
  }

  const withRates = eligible.map((g) => ({ ...g, selectionRate: g.totalConsidered > 0 ? g.selected / g.totalConsidered : 0 }));
  const reference = withRates.reduce((max, g) => (g.selectionRate > max.selectionRate ? g : max), withRates[0]);

  if (reference.selectionRate === 0) {
    return {
      decisionCode: 'REQUIRES_REVIEW',
      groups: [...withRates.map((g) => ({ group: g.group, selectionRate: 0, excludedForSmallSample: false })), ...excludedResults],
      explanation: 'No favorable outcomes were recorded in any group with sufficient data; cannot compute an adverse-impact ratio. Route to human review.',
    };
  }

  const results: HrAiGovernanceGroupResult[] = withRates.map((g) => {
    const impactRatio = round(g.selectionRate / reference.selectionRate);
    return {
      group: g.group,
      selectionRate: round(g.selectionRate),
      impactRatio,
      adverseImpact: g.group !== reference.group && impactRatio < impactRatioThreshold,
      excludedForSmallSample: false,
    };
  });

  const failing = results.filter((g) => g.adverseImpact);
  const decisionCode: HrAiGovernanceDecisionCode = failing.length > 0 ? 'REJECTED' : 'APPROVED';
  const explanation = failing.length > 0
    ? `Adverse impact detected for ${failing.map((g) => g.group).join(', ')} relative to reference group "${reference.group}" (four-fifths threshold ${round(impactRatioThreshold * 100, 1)}%). Statistical screen only — requires human review before any compliance conclusion.`
    : `All ${results.length} eligible group(s) meet the four-fifths rule relative to reference group "${reference.group}". Statistical screen only, not a compliance certification.`;

  return { decisionCode, referenceGroup: reference.group, groups: [...results, ...excludedResults], explanation };
}

export class HrAiGovernanceEngine implements PolicyEngine<HrAiGovernanceBiasAuditInput, DecisionRecord> {
  readonly definition: PolicyEngineDefinition = {
    engineName: 'hr-ai-governance',
    engineVersion: '1.4.0',
    description:
      'Computes the four-fifths adverse-impact-ratio bias screen for AI/ML use cases in HR decisions '
      + '(resume screening, candidate ranking) from per-protected-class-group outcome counts.',
    inputTypes: ['BiasAuditReport'],
    outputDecisionCodes: ['APPROVED', 'REJECTED', 'REQUIRES_REVIEW'],
    associatedRulePacks: ['ai-governance-rules'],
    associatedTables: ['hr_ai.hr_ai_use_cases', 'hr_ai.hr_ai_bias_tests'],
    invocationPattern: 'ASYNC',
    maxDurationMs: 5000,
    requiresCountryPolicyPack: false,
    requiresHumanReview: true,
    auditRequired: true,
  };

  async execute(input: HrAiGovernanceBiasAuditInput, context: EngineContext): Promise<DecisionRecord> {
    const result = evaluateHrAiGovernanceBiasAudit(input);
    return {
      decisionId: new Uuid(randomUUID()),
      decisionCode: result.decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'ai-governance-rules',
      ruleSetVersion: '1.0.0',
      explanation: result.explanation,
      sourceInputIds: [input.useCaseId],
      inputSnapshotHash: '<SHA-256>',
      timestamp: new Date(),
      tenantId: context.tenantId,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveDate: context.effectiveDate,
      metadata: { groups: result.groups, referenceGroup: result.referenceGroup },
    };
  }
}
