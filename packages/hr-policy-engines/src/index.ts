/**
 * @hcm/policy-engines
 *
 * Policy engine framework (the "brain") for the HR/HCM platform.
 *
 * - Immutable, explainable, versioned decision records
 * - Rule pack lifecycle: DRAFT → REVIEW → APPROVED → ACTIVE → [SUPERSEDED | EMERGENCY_ROLLBACK] → RETIRED
 * - Deterministic resolution: countryCode+regionCode+legalEntityId+payGroup > ... > platform default
 * - Effective date resolution: latest effectiveFrom ≤ calculation date
 * - Invocation patterns: SYNC (<50–500 ms), ASYNC (event-driven), SAGA-COORDINATED
 * - Country policy packs feed into engines (V1.4)
 * - No hardcoded country-specific values in application code
 */

// ── Core ──
export type {
  DecisionOutcome,
  DecisionSeverity,
  DecisionVariance,
  DecisionException,
  DecisionRecord,
} from './core/decision-record.js';

export type {
  InvocationPattern,
  PolicyEngineDefinition,
  PolicyEngine,
  EngineContext,
} from './core/engine-definition.js';

export { EngineRegistry } from './core/engine-definition.js';

export type {
  EngineJobId,
  EngineInvoker,
} from './core/engine-invoker.js';

// ── Rule Packs ──
export type {
  RulePackStatus,
  Rule,
  ValidationRule,
  RulePack,
} from './rule-packs/rule-pack.js';

export type {
  ResolutionContext,
  RulePackRepository,
} from './rule-packs/rule-pack-loader.js';

export { RulePackLoader } from './rule-packs/rule-pack-loader.js';

export type {
  CountryPolicyPackStatus,
  CountryPolicySection,
  ApprovalStep,
  SourceEvidence,
  CountryPolicyPack,
} from './rule-packs/country-policy-pack.js';

// ── Engines ──
export type {
  EmploymentEligibilityDecisionCode,
  EmploymentEligibilityInput,
} from './engines/employment-eligibility.engine.js';

export { EmploymentEligibilityEngine, evaluateEmploymentEligibility } from './engines/employment-eligibility.engine.js';

export type {
  PayrollValidationDecisionCode,
  PayrollValidationInput,
  PayrollValidationViolation,
  PayrollValidationResult,
} from './engines/payroll-validation.engine.js';

export { PayrollValidationEngine, evaluatePayrollValidation } from './engines/payroll-validation.engine.js';

export type {
  SelfServiceAllowlistDecisionCode,
  SelfServiceAuthorityInput,
} from './engines/self-service.engine.js';

export { SelfServiceAuthorityEngine } from './engines/self-service.engine.js';

export type {
  FieldAccessDecisionCode,
  FieldAccessInput,
} from './engines/field-access.engine.js';

export { FieldAccessPolicyEngine, evaluateFieldAccess } from './engines/field-access.engine.js';

export type {
  CountryPolicyValidationDecisionCode,
  CountryPolicyValidationInput,
  CountryPolicyViolation,
  CountryPolicyValidationResult,
  CountryPolicyImpactLevel,
  CountryPolicyImpactResult,
} from './engines/country-policy-validation.engine.js';

export {
  CountryPolicyValidationEngine,
  evaluateCountryPolicyPackValidation,
  evaluateCountryPolicyPackImpact,
  KNOWN_SECTION_TYPES,
} from './engines/country-policy-validation.engine.js';

export {
  engineRegistry,
  employmentEligibilityEngine,
  payrollValidationEngine,
  selfServiceAuthorityEngine,
  fieldAccessPolicyEngine,
  countryPolicyValidationEngine,
} from './engines/registered-engines.js';
