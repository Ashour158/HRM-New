/**
 * Lifecycle states of a rule pack.
 *
 * Transitions (simplified):
 * DRAFT → REVIEW → APPROVED → ACTIVE → [SUPERSEDED | EMERGENCY_ROLLBACK] → RETIRED
 */
export type RulePackStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'EMERGENCY_ROLLBACK'
  | 'RETIRED';

/**
 * A single business rule inside a {@link RulePack}.
 *
 * Rules are evaluated in priority order. The first rule whose
 * `appliesWhen` conditions match the input context wins.
 */
export interface Rule {
  /** Unique rule identifier within the pack. */
  readonly ruleId: string;

  /** Classification of the rule (e.g. 'TAX_DEDUCTION', 'LEAVE_ENTITLEMENT'). */
  readonly ruleType: string;

  /** Evaluation priority (lower number = higher priority). */
  readonly priority: number;

  /** Structured conditions under which this rule applies. */
  readonly appliesWhen: Record<string, unknown>;

  /** Optional expression describing the basis of calculation. */
  readonly basisExpression?: string;

  /** Optional expression describing the rate or multiplier. */
  readonly rateExpression?: string;

  /** Optional expression describing caps or limits. */
  readonly limitExpression?: string;

  /** Optional rounding behaviour (e.g. 'HALF_UP', 'DOWN'). */
  readonly roundingMode?: string;

  /** Mustache-style template used to build the human-readable explanation. */
  readonly explanationTemplate: string;

  /** Optional jurisdiction code for sub-country granularity. */
  readonly jurisdictionCode?: string;
}

/**
 * Validation rule that guards data quality before engine evaluation.
 */
export interface ValidationRule {
  /** Canonical validation code. */
  readonly code: string;

  /** Severity of a validation failure. */
  readonly severity: 'BLOCKING' | 'WARNING' | 'INFO';

  /** Boolean expression (or DSL string) describing the guard condition. */
  readonly condition: string;

  /** Template for the validation message rendered to users. */
  readonly messageTemplate: string;
}

/**
 * A versioned, jurisdiction-scoped collection of {@link Rule}s and {@link ValidationRule}s.
 *
 * Rule packs are the primary data-driven artifact fed into policy engines.
 * No hardcoded country-specific values belong in application code.
 */
export interface RulePack {
  /** Composite key identifying the rule set (e.g. 'US-FEDERAL-PAYROLL-2026'). */
  readonly ruleSetKey: string;

  /** Semantic version of the pack (e.g. '2026.1.0'). */
  readonly ruleSetVersion: string;

  /** ISO-3166 alpha-2 country code. */
  readonly countryCode: string;

  /** Optional region / state code. */
  readonly regionCode?: string;

  /** Optional list of legal entities for which this pack is scoped. */
  readonly legalEntityScope?: string[];

  /** Optional list of pay groups for which this pack is scoped. */
  readonly payGroupScope?: string[];

  /** Date from which this pack becomes effective. */
  readonly effectiveFrom: Date;

  /** Optional expiry date. */
  readonly effectiveUntil?: Date;

  /** Current lifecycle status. */
  readonly status: RulePackStatus;

  /** Reference to the pack that superseded this one, if applicable. */
  readonly supersededBy?: string;

  /** The ordered rule definitions. */
  readonly rules: Rule[];

  /** Data-quality guard definitions. */
  readonly validationRules: ValidationRule[];

  /** Arbitrary metadata (author, change-request id, etc.). */
  readonly metadata: Record<string, unknown>;
}
