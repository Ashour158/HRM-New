import type { Uuid } from '@hcm/shared-kernel';

/**
 * The outcome classification of a policy decision.
 */
export type DecisionOutcome =
  | 'APPROVED'
  | 'REJECTED'
  | 'CONDITIONAL'
  | 'REQUIRES_REVIEW'
  | 'ERROR';

/**
 * Severity levels for decision exceptions.
 */
export type DecisionSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

/**
 * Variance metadata when a decision detects a deviation
 * between expected and actual values.
 */
export interface DecisionVariance {
  readonly expected: unknown;
  readonly actual: unknown;
  readonly tolerance: unknown;
}

/**
 * Exception metadata attached to a decision record.
 */
export interface DecisionException {
  readonly code: string;
  readonly message: string;
  readonly severity: DecisionSeverity;
}

/**
 * Immutable value object representing the result of a policy engine execution.
 *
 * Decision records are append-only and versioned. Every engine invocation
 * produces at least one record so that every outcome is fully explainable.
 */
export interface DecisionRecord {
  /** Unique identifier for this decision. */
  readonly decisionId: Uuid;

  /** Canonical code describing the decision topic, e.g. 'PAYROLL_RESULT_FINALIZED'. */
  readonly decisionCode: string;

  /** Name of the engine that produced the decision. */
  readonly engineName: string;

  /** Semantic version of the engine implementation. */
  readonly engineVersion: string;

  /** Reference to the rule set that was active at evaluation time. */
  readonly ruleSetId: string;

  /** Semantic version of the rule set. */
  readonly ruleSetVersion: string;

  /** Optional identifier of the specific rule that triggered this decision. */
  readonly ruleId?: string;

  /** Human-readable, rule-based explanation suitable for audit logs and UI. */
  readonly explanation: string;

  /** References to the input data records that fed the engine. */
  readonly sourceInputIds: string[];

  /** SHA-256 hash of the canonical input snapshot (reproducibility / tamper-evidence). */
  readonly inputSnapshotHash: string;

  /** Optional variance when the decision involves numerical tolerances. */
  readonly variance?: DecisionVariance;

  /** Optional exception raised during evaluation. */
  readonly exception?: DecisionException;

  /** UTC timestamp of when the decision was produced. */
  readonly timestamp: Date;

  /** Tenant that owns the decision. */
  readonly tenantId: Uuid;

  /** Actor (user or service) that triggered the engine, if known. */
  readonly actorId?: Uuid;

  /** Correlation identifier grouping related decisions across engines / sagas. */
  readonly correlationId: Uuid;

  /** The date for which the decision is effective (used for retroactive / future-dated evaluation). */
  readonly effectiveDate: Date;

  /** Optional country scope. */
  readonly countryCode?: string;

  /** Optional region scope. */
  readonly regionCode?: string;

  /** Optional legal entity scope. */
  readonly legalEntityId?: string;

  /** Optional pay group scope. */
  readonly payGroup?: string;

  /** Arbitrary additional metadata (engine-specific). */
  readonly metadata?: Record<string, unknown>;
}
