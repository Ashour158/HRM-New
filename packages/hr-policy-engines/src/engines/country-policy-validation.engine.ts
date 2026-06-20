import { randomUUID } from 'node:crypto';
import { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from '../core/decision-record.js';
import type { EngineContext, PolicyEngine, PolicyEngineDefinition } from '../core/engine-definition.js';

/**
 * Decision codes emitted by the Country Policy Validation Engine.
 */
export type CountryPolicyValidationDecisionCode = 'VALID' | 'INVALID' | 'REQUIRES_REVIEW';

/** Section types recognised in a country policy pack. */
export const KNOWN_SECTION_TYPES = [
  'LABOR',
  'PAYROLL',
  'TAX',
  'LEAVE',
  'BENEFITS',
  'CONTRACTS',
  'I9_EVERIFY',
  'STATUTORY_REPORTING',
  'WORKS_COUNCIL',
  'DATA_RETENTION',
  'LOCAL_FORMS',
] as const;

/** Section types whose changes can require retroactive recalculation. */
const RETROACTIVE_SECTION_TYPES = new Set(['PAYROLL', 'TAX', 'LEAVE', 'BENEFITS']);

export interface CountryPolicyValidationInput {
  readonly countryCode: string;
  /** Sections keyed by sectionType; each value is the section's structured content. */
  readonly sections: Record<string, unknown>;
  readonly requiredApprovals: string[];
  readonly sourceEvidence: Record<string, unknown>;
  readonly effectiveFrom: Date;
  readonly effectiveUntil?: Date;
  readonly validationType: string;
}

export interface CountryPolicyViolation {
  readonly code: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}

export interface CountryPolicyValidationResult {
  readonly decisionCode: CountryPolicyValidationDecisionCode;
  readonly valid: boolean;
  readonly violations: CountryPolicyViolation[];
}

const ISO_3166_ALPHA2 = /^[A-Z]{2}$/;

function sectionContent(value: unknown): Record<string, unknown> | undefined {
  // A section may be stored either as its content object directly, or wrapped
  // as `{ content: {...}, schemaVersion }`. Accept both shapes.
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.content && typeof obj.content === 'object') return obj.content as Record<string, unknown>;
    return obj;
  }
  return undefined;
}

/**
 * Pure, deterministic structural/semantic validation of a country policy pack.
 * Replaces the previous hardcoded `valid = true`: a pack with no sections, an
 * invalid country code, empty section content, or an inverted effective window
 * now fails closed.
 */
export function evaluateCountryPolicyPackValidation(
  input: CountryPolicyValidationInput,
): CountryPolicyValidationResult {
  const violations: CountryPolicyViolation[] = [];

  if (!ISO_3166_ALPHA2.test(input.countryCode)) {
    violations.push({
      code: 'INVALID_COUNTRY_CODE',
      severity: 'ERROR',
      message: `Country code "${input.countryCode}" is not a valid ISO-3166 alpha-2 code.`,
    });
  }

  const sectionKeys = Object.keys(input.sections ?? {});
  if (sectionKeys.length === 0) {
    violations.push({
      code: 'NO_SECTIONS',
      severity: 'ERROR',
      message: 'Policy pack contains no sections.',
    });
  }

  for (const key of sectionKeys) {
    const content = sectionContent(input.sections[key]);
    if (!content || Object.keys(content).length === 0) {
      violations.push({
        code: 'SECTION_CONTENT_MISSING',
        severity: 'ERROR',
        message: `Section "${key}" has no content.`,
      });
    }
    if (!KNOWN_SECTION_TYPES.includes(key as (typeof KNOWN_SECTION_TYPES)[number])) {
      violations.push({
        code: 'UNKNOWN_SECTION_TYPE',
        severity: 'WARNING',
        message: `Section "${key}" is not a recognised section type.`,
      });
    }
  }

  const from = input.effectiveFrom instanceof Date ? input.effectiveFrom : new Date(input.effectiveFrom);
  if (Number.isNaN(from.getTime())) {
    violations.push({
      code: 'INVALID_EFFECTIVE_FROM',
      severity: 'ERROR',
      message: 'effectiveFrom is not a valid date.',
    });
  }
  if (input.effectiveUntil) {
    const until = input.effectiveUntil instanceof Date ? input.effectiveUntil : new Date(input.effectiveUntil);
    if (!Number.isNaN(until.getTime()) && !Number.isNaN(from.getTime()) && until.getTime() <= from.getTime()) {
      violations.push({
        code: 'EFFECTIVE_WINDOW_INVERTED',
        severity: 'ERROR',
        message: 'effectiveUntil must be after effectiveFrom.',
      });
    }
  }

  if (Object.keys(input.sourceEvidence ?? {}).length === 0) {
    violations.push({
      code: 'NO_SOURCE_EVIDENCE',
      severity: 'WARNING',
      message: 'No provenance / source evidence attached to the pack.',
    });
  }

  if ((input.requiredApprovals ?? []).length === 0) {
    violations.push({
      code: 'NO_REQUIRED_APPROVALS',
      severity: 'WARNING',
      message: 'No required approval steps declared for the pack.',
    });
  }

  const hasError = violations.some((v) => v.severity === 'ERROR');
  const hasWarning = violations.some((v) => v.severity === 'WARNING');
  const decisionCode: CountryPolicyValidationDecisionCode = hasError
    ? 'INVALID'
    : hasWarning
      ? 'REQUIRES_REVIEW'
      : 'VALID';

  return { decisionCode, valid: !hasError, violations };
}

export type CountryPolicyImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CountryPolicyImpactResult {
  readonly impactLevel: CountryPolicyImpactLevel;
  readonly impactedDomains: string[];
  readonly recalculationRequired: boolean;
  readonly impactedSectionCount: number;
}

/**
 * Pure, deterministic structural impact estimation. Replaces the previous
 * hardcoded `impactedCount: 0` / `recalculationRequired: false`: the impacted
 * domains and recalculation flag are now derived from the pack's sections.
 */
export function evaluateCountryPolicyPackImpact(input: {
  sections: Record<string, unknown>;
}): CountryPolicyImpactResult {
  const impactedDomains = Object.keys(input.sections ?? {});
  const retroactiveDomains = impactedDomains.filter((d) => RETROACTIVE_SECTION_TYPES.has(d));
  const recalculationRequired = retroactiveDomains.length > 0;

  let impactLevel: CountryPolicyImpactLevel = 'LOW';
  if (retroactiveDomains.length >= 3 || impactedDomains.length >= 6) {
    impactLevel = 'HIGH';
  } else if (retroactiveDomains.length >= 1 || impactedDomains.length >= 3) {
    impactLevel = 'MEDIUM';
  }

  return {
    impactLevel,
    impactedDomains,
    recalculationRequired,
    impactedSectionCount: impactedDomains.length,
  };
}

/**
 * Country Policy Validation Engine — wraps {@link evaluateCountryPolicyPackValidation}
 * in the standard {@link PolicyEngine} contract so validation produces an
 * explainable, auditable {@link DecisionRecord}.
 */
export class CountryPolicyValidationEngine
  implements PolicyEngine<CountryPolicyValidationInput, DecisionRecord>
{
  readonly definition: PolicyEngineDefinition = {
    engineName: 'country-policy-validation',
    engineVersion: '1.4.0',
    description:
      'Validates the structural and semantic integrity of a country policy pack '
      + '(country code, sections, effective window, provenance, approvals).',
    inputTypes: ['CountryPolicyPack'],
    outputDecisionCodes: ['VALID', 'INVALID', 'REQUIRES_REVIEW'],
    associatedRulePacks: ['country-policy-pack-rules'],
    associatedTables: ['country_policy_packs', 'country_policy_validation_runs'],
    invocationPattern: 'SYNC',
    maxDurationMs: 500,
    requiresCountryPolicyPack: false,
    requiresHumanReview: false,
    auditRequired: true,
  };

  async execute(
    input: CountryPolicyValidationInput,
    context: EngineContext,
  ): Promise<DecisionRecord> {
    const result = evaluateCountryPolicyPackValidation(input);

    return {
      decisionId: new Uuid(randomUUID()),
      decisionCode: result.decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'country-policy-pack-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `Country policy pack for ${input.countryCode} validated (${input.validationType}). `
        + `Result: ${result.decisionCode}`
        + (result.violations.length ? `; ${result.violations.map((v) => v.code).join(', ')}.` : '.'),
      sourceInputIds: [input.countryCode],
      inputSnapshotHash: '<SHA-256>',
      timestamp: new Date(),
      tenantId: context.tenantId,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveDate: context.effectiveDate,
      countryCode: input.countryCode,
    };
  }
}
