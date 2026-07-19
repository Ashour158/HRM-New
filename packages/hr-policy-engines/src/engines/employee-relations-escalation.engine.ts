import { randomUUID } from 'node:crypto';
import { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from '../core/decision-record.js';
import type { EngineContext, PolicyEngine, PolicyEngineDefinition } from '../core/engine-definition.js';

/**
 * Employee-Relations & Disciplinary Escalation Engine — replaces the previous
 * metadata-only `employee-relations-disciplinary` registration (no execute(),
 * nothing ever branched on `severity`) with a real, deterministic severity-driven
 * escalation gate.
 *
 * Severity taxonomy: `LOW` | `MEDIUM` | `HIGH`. This matches the values already
 * produced by the domain — the `employee-relations-case.aggregate.ts` /
 * `disciplinary-action.aggregate.ts` repositories and
 * `employee-relations.controller.spec.ts` already read/write exactly these three
 * strings; no fourth tier (e.g. `CRITICAL`) is stored or asserted anywhere in the
 * codebase, so none is invented here.
 *
 * Escalation rule: any case or disciplinary action whose severity is at or above
 * the configurable {@link DEFAULT_LEGAL_REVIEW_SEVERITY_THRESHOLD} (`HIGH` by
 * default) requires a recorded legal review before it can be finalized. Pure +
 * deterministic; no I/O — the aggregate is the source of truth for whether a
 * review has actually been recorded (`legalReviewCompleted`).
 */
export type CaseSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

/** All valid {@link CaseSeverity} values, ordered low → high (for Guard.againstInvalidEnum, etc.). */
export const CASE_SEVERITIES: readonly CaseSeverity[] = ['LOW', 'MEDIUM', 'HIGH'];

const SEVERITY_RANK: Record<CaseSeverity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/**
 * Default severity floor at/above which legal review is mandatory before a
 * disciplinary action can be finalized (executed). Callers may override this
 * per-evaluation via {@link DisciplinaryEscalationInput.legalReviewSeverityThreshold}
 * — e.g. to wire a future per-tenant HCM setup policy — without changing the
 * engine itself.
 */
export const DEFAULT_LEGAL_REVIEW_SEVERITY_THRESHOLD: CaseSeverity = 'HIGH';

export type DisciplinaryEscalationDecisionCode = 'APPROVED' | 'REJECTED' | 'REQUIRES_REVIEW';

export interface DisciplinaryEscalationInput {
  /** Severity of the case or disciplinary action being evaluated. */
  readonly severity: CaseSeverity;
  /** Whether a legal review has already been recorded (e.g. LegalReviewCompleted). */
  readonly legalReviewCompleted: boolean;
  /** Configurable severity floor; defaults to {@link DEFAULT_LEGAL_REVIEW_SEVERITY_THRESHOLD}. */
  readonly legalReviewSeverityThreshold?: CaseSeverity;
}

export interface DisciplinaryEscalationResult {
  readonly decisionCode: DisciplinaryEscalationDecisionCode;
  /** True when severity meets/exceeds the legal-review threshold. */
  readonly requiresLegalReview: boolean;
  /** True when the terminal (finalize/execute) command may proceed. */
  readonly canFinalize: boolean;
  readonly reasons: string[];
}

/**
 * Deterministically evaluate whether a disciplinary escalation requires legal
 * review, and whether it may proceed to finalization. Fails closed: any
 * severity at/above the threshold blocks finalization until
 * `legalReviewCompleted` is true.
 */
export function evaluateDisciplinaryEscalation(input: DisciplinaryEscalationInput): DisciplinaryEscalationResult {
  const threshold = input.legalReviewSeverityThreshold ?? DEFAULT_LEGAL_REVIEW_SEVERITY_THRESHOLD;
  const requiresLegalReview = SEVERITY_RANK[input.severity] >= SEVERITY_RANK[threshold];

  const reasons: string[] = [];
  if (requiresLegalReview) {
    reasons.push(`Severity ${input.severity} meets or exceeds the legal-review threshold (${threshold}).`);
    reasons.push(
      input.legalReviewCompleted
        ? 'Legal review has been recorded.'
        : 'Legal review has not yet been recorded.',
    );
  }

  const canFinalize = !requiresLegalReview || input.legalReviewCompleted;
  const decisionCode: DisciplinaryEscalationDecisionCode = canFinalize ? 'APPROVED' : 'REQUIRES_REVIEW';

  return { decisionCode, requiresLegalReview, canFinalize, reasons };
}

/**
 * Employee-Relations & Disciplinary Escalation Engine — wraps
 * {@link evaluateDisciplinaryEscalation} in the standard {@link PolicyEngine}
 * contract so the escalation decision is explainable and auditable, matching
 * the `employee-relations-disciplinary` definition already registered in
 * `registered-engines.ts` (SAGA invocation, human review required).
 */
export class EmployeeRelationsDisciplinaryEscalationEngine
  implements PolicyEngine<DisciplinaryEscalationInput, DecisionRecord>
{
  readonly definition: PolicyEngineDefinition = {
    engineName: 'employee-relations-disciplinary',
    engineVersion: '1.4.0',
    description:
      'Guides disciplinary workflow steps, escalation rules, and statutory timelines.',
    inputTypes: ['DisciplinaryCase', 'IncidentReport', 'WorkerProfile'],
    outputDecisionCodes: ['APPROVED', 'REJECTED', 'REQUIRES_REVIEW'],
    associatedRulePacks: ['disciplinary-procedure-rules'],
    associatedTables: ['disciplinary_cases', 'incident_reports'],
    invocationPattern: 'SAGA',
    maxDurationMs: 0,
    requiresCountryPolicyPack: true,
    requiresHumanReview: true,
    auditRequired: true,
  };

  async execute(input: DisciplinaryEscalationInput, context: EngineContext): Promise<DecisionRecord> {
    const result = evaluateDisciplinaryEscalation(input);

    return {
      decisionId: new Uuid(randomUUID()),
      decisionCode: result.decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'disciplinary-procedure-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `Severity ${input.severity} evaluated against the legal-review escalation gate `
        + `(legalReviewCompleted=${input.legalReviewCompleted}). Result: ${result.decisionCode}`
        + (result.reasons.length ? `; ${result.reasons.join(' ')}` : '.'),
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
