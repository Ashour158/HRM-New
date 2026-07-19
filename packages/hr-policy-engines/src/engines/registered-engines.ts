import { EngineRegistry } from '../core/engine-definition.js';
import { EmploymentEligibilityEngine } from './employment-eligibility.engine.js';
import { FieldAccessPolicyEngine } from './field-access.engine.js';
import { PayrollValidationEngine } from './payroll-validation.engine.js';
import { SelfServiceAuthorityEngine } from './self-service.engine.js';
import { CountryPolicyValidationEngine } from './country-policy-validation.engine.js';
import { OfferCompensationEngine } from './offer-compensation.engine.js';
import { EmployeeRelationsDisciplinaryEscalationEngine } from './employee-relations-escalation.engine.js';
import { RecruitingFairnessComplianceEngine } from './recruiting-fairness-compliance.engine.js';
import { DeiPayTransparencyEngine } from './dei-pay-transparency.engine.js';

/**
 * Singleton registry holding the declarative definitions for every
 * policy engine in the HCM platform.
 */
export const engineRegistry = new EngineRegistry();

/* ── 1. Employment Eligibility ── */
engineRegistry.register({
  engineName: 'employment-eligibility',
  engineVersion: '1.4.0',
  description: 'Determines whether a worker profile satisfies hiring eligibility criteria.',
  inputTypes: ['WorkerProfile', 'WorkAuthorization'],
  outputDecisionCodes: [
    'ELIGIBLE',
    'NOT_ELIGIBLE',
    'REQUIRES_WORK_AUTHORIZATION',
    'REQUIRES_BACKGROUND_CHECK',
  ],
  associatedRulePacks: ['global-hiring-eligibility-rules'],
  associatedTables: ['workers', 'work_authorizations', 'legal_entities'],
  invocationPattern: 'SYNC',
  maxDurationMs: 200,
  requiresCountryPolicyPack: false,
  requiresHumanReview: false,
  auditRequired: true,
});

export const employmentEligibilityEngine = new EmploymentEligibilityEngine();

/* ── 2. Position & Headcount ── */
engineRegistry.register({
  engineName: 'position-headcount',
  engineVersion: '1.4.0',
  description: 'Enforces headcount budgets, position control, and FTE limits.',
  inputTypes: ['Position', 'HeadcountBudget', 'OrganizationUnit'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['position-control-rules'],
  associatedTables: ['positions', 'headcount_budgets', 'organization_units'],
  invocationPattern: 'SYNC',
  maxDurationMs: 150,
  requiresCountryPolicyPack: false,
  requiresHumanReview: false,
  auditRequired: true,
});

/* ── 3. Recruiting Fairness & Compliance ── */
engineRegistry.register({
  engineName: 'recruiting-fairness-compliance',
  engineVersion: '1.4.0',
  description:
    'Ensures recruiting workflows comply with diversity, equal-opportunity, '
    + 'and local labor-market regulations. Implements EEOC 4/5ths-rule adverse-impact '
    + 'screening of funnel-stage selection rates (see RecruitingFairnessComplianceEngine).',
  inputTypes: ['Requisition', 'CandidatePool', 'InterviewPlan'],
  outputDecisionCodes: ['COMPLIANT', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['recruiting-compliance-rules'],
  associatedTables: ['requisitions', 'candidates', 'interviews'],
  invocationPattern: 'ASYNC',
  maxDurationMs: 2000,
  requiresCountryPolicyPack: true,
  requiresHumanReview: true,
  auditRequired: true,
});

/* ── 4. Offer & Compensation ── */
engineRegistry.register({
  engineName: 'offer-compensation',
  engineVersion: '1.4.0',
  description:
    'Validates offer packages against compensation bands, pay-equity policies, '
    + 'and statutory minimums.',
  inputTypes: ['OfferPackage', 'CompensationBand', 'PayEquityReport'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'CONDITIONAL'],
  associatedRulePacks: ['compensation-band-rules', 'pay-equity-rules'],
  associatedTables: ['offers', 'compensation_bands', 'pay_equity_reports'],
  invocationPattern: 'SYNC',
  maxDurationMs: 300,
  requiresCountryPolicyPack: true,
  requiresHumanReview: true,
  auditRequired: true,
});

/* ── 5. Time, Absence & Leave ── */
engineRegistry.register({
  engineName: 'time-absence-leave',
  engineVersion: '1.4.0',
  description:
    'Computes leave entitlements, absence quotas, and statutory holiday rules.',
  inputTypes: ['LeaveRequest', 'AbsenceRecord', 'WorkSchedule'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['leave-entitlement-rules', 'absence-quota-rules'],
  associatedTables: ['leave_requests', 'absences', 'work_schedules'],
  invocationPattern: 'SYNC',
  maxDurationMs: 200,
  requiresCountryPolicyPack: true,
  requiresHumanReview: false,
  auditRequired: true,
});

/* ── 6. Payroll Validation ── */
engineRegistry.register({
  engineName: 'payroll-validation',
  engineVersion: '1.4.0',
  description: 'Validates payroll inputs for completeness and statutory compliance.',
  inputTypes: ['PayrollCycle', 'PayrollInput', 'WorkerProfile'],
  outputDecisionCodes: ['VALID', 'INVALID', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['payroll-input-completeness-rules'],
  associatedTables: ['payroll_cycles', 'payroll_inputs', 'workers'],
  invocationPattern: 'SYNC',
  maxDurationMs: 500,
  requiresCountryPolicyPack: true,
  requiresHumanReview: true,
  auditRequired: true,
});

export const payrollValidationEngine = new PayrollValidationEngine();

/* ── 7. Performance & Calibration ── */
engineRegistry.register({
  engineName: 'performance-calibration',
  engineVersion: '1.4.0',
  description:
    'Enforces calibration guidelines, rating distributions, and review-cycle policies.',
  inputTypes: ['PerformanceReview', 'CalibrationSession', 'RatingDistribution'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['performance-calibration-rules'],
  associatedTables: ['performance_reviews', 'calibration_sessions'],
  invocationPattern: 'ASYNC',
  maxDurationMs: 3000,
  requiresCountryPolicyPack: false,
  requiresHumanReview: true,
  auditRequired: true,
});

/* ── 8. Employee Relations & Disciplinary ── */
engineRegistry.register({
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
});

// Binds the concrete executable engine for the definition above — real
// severity-driven legal-review escalation gating (see
// employee-relations-escalation.engine.ts), replacing the previous
// metadata-only registration.
export const employeeRelationsDisciplinaryEngine = new EmployeeRelationsDisciplinaryEscalationEngine();

/* ── 9. Talent & Succession ── */
engineRegistry.register({
  engineName: 'talent-succession',
  engineVersion: '1.4.0',
  description:
    'Validates succession-plan nominations against readiness criteria and bias checks.',
  inputTypes: ['SuccessionPlan', 'Nomination', 'ReadinessAssessment'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['succession-planning-rules'],
  associatedTables: ['succession_plans', 'nominations', 'readiness_assessments'],
  invocationPattern: 'ASYNC',
  maxDurationMs: 2000,
  requiresCountryPolicyPack: false,
  requiresHumanReview: true,
  auditRequired: true,
});

/* ── 10. HR Privacy & Visibility ── */
engineRegistry.register({
  engineName: 'hr-privacy-visibility',
  engineVersion: '1.4.0',
  description:
    'Resolves data-privacy constraints, consent checks, and visibility policies.',
  inputTypes: ['DataSubjectRequest', 'ConsentRecord', 'PrivacyPolicy'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['privacy-governance-rules'],
  associatedTables: ['consent_records', 'privacy_policies', 'data_subject_requests'],
  invocationPattern: 'SYNC',
  maxDurationMs: 150,
  requiresCountryPolicyPack: true,
  requiresHumanReview: false,
  auditRequired: true,
});

/* ── 11. Compensation, Equity & Total Rewards ── */
engineRegistry.register({
  engineName: 'compensation-equity-total-rewards',
  engineVersion: '1.4.0',
  description:
    'Evaluates long-term incentive grants, equity refresh, and total-rewards statements.',
  inputTypes: ['EquityGrant', 'CompensationStatement', 'TotalRewardsModel'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'CONDITIONAL'],
  associatedRulePacks: ['equity-compensation-rules', 'total-rewards-rules'],
  associatedTables: ['equity_grants', 'compensation_statements'],
  invocationPattern: 'SYNC',
  maxDurationMs: 300,
  requiresCountryPolicyPack: true,
  requiresHumanReview: true,
  auditRequired: true,
});

/* ── 12. Workforce Management & Scheduling ── */
engineRegistry.register({
  engineName: 'workforce-management-scheduling',
  engineVersion: '1.4.0',
  description:
    'Validates shift schedules, break rules, and overtime thresholds.',
  inputTypes: ['ShiftPattern', 'ScheduleRequest', 'OvertimeRecord'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'CONDITIONAL'],
  associatedRulePacks: ['scheduling-rules', 'overtime-rules'],
  associatedTables: ['shift_patterns', 'schedules', 'overtime_records'],
  invocationPattern: 'SYNC',
  maxDurationMs: 200,
  requiresCountryPolicyPack: true,
  requiresHumanReview: false,
  auditRequired: true,
});

/* ── 13. Global Labor-Law Localization ── */
engineRegistry.register({
  engineName: 'global-labor-law-localization',
  engineVersion: '1.4.0',
  description:
    'Applies localized labor-law constraints (working time, minimum wage, termination notice).',
  inputTypes: ['EmploymentContract', 'WorkEvent', 'LocalRegulation'],
  outputDecisionCodes: ['COMPLIANT', 'NON_COMPLIANT', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['labor-law-localization-rules'],
  associatedTables: ['employment_contracts', 'local_regulations'],
  invocationPattern: 'SYNC',
  maxDurationMs: 250,
  requiresCountryPolicyPack: true,
  requiresHumanReview: false,
  auditRequired: true,
});

/* ── 14. Benefits ── */
engineRegistry.register({
  engineName: 'benefits',
  engineVersion: '1.4.0',
  description:
    'Determines benefit eligibility, enrolment windows, and dependent coverage rules.',
  inputTypes: ['BenefitEnrollment', 'DependentRecord', 'PlanOption'],
  outputDecisionCodes: ['ELIGIBLE', 'NOT_ELIGIBLE', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['benefits-enrolment-rules'],
  associatedTables: ['benefit_enrollments', 'dependents', 'plan_options'],
  invocationPattern: 'SYNC',
  maxDurationMs: 200,
  requiresCountryPolicyPack: true,
  requiresHumanReview: false,
  auditRequired: true,
});

/* ── 15. HR Service Delivery ── */
engineRegistry.register({
  engineName: 'hr-service-delivery',
  engineVersion: '1.4.0',
  description:
    'Routes HR cases, tracks SLA compliance, and escalates breached tickets.',
  inputTypes: ['ServiceCase', 'SlaDefinition', 'RoutingRule'],
  outputDecisionCodes: ['ROUTED', 'ESCALATED', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['service-delivery-rules'],
  associatedTables: ['service_cases', 'sla_definitions'],
  invocationPattern: 'ASYNC',
  maxDurationMs: 1500,
  requiresCountryPolicyPack: false,
  requiresHumanReview: false,
  auditRequired: true,
});

/* ── 16. Self-Service Authority ── */
engineRegistry.register({
  engineName: 'self-service-authority',
  engineVersion: '1.4.0',
  description:
    'Determines if a self-service action is permitted, requires approval, or is forbidden.',
  inputTypes: ['ActorType', 'CommandName', 'ActorRole', 'AbacContext'],
  outputDecisionCodes: ['ALLOWED', 'REQUIRES_APPROVAL', 'FORBIDDEN'],
  associatedRulePacks: ['employee-self-service-rules'],
  associatedTables: ['self_service_rules', 'actor_roles', 'approval_workflows'],
  invocationPattern: 'SYNC',
  maxDurationMs: 100,
  requiresCountryPolicyPack: false,
  requiresHumanReview: false,
  auditRequired: true,
});

export const selfServiceAuthorityEngine = new SelfServiceAuthorityEngine();

/* ── 17. Workforce Planning ── */
engineRegistry.register({
  engineName: 'workforce-planning',
  engineVersion: '1.4.0',
  description:
    'Validates workforce plans, scenario models, and demand-supply forecasts.',
  inputTypes: ['WorkforcePlan', 'ScenarioModel', 'DemandForecast'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'CONDITIONAL'],
  associatedRulePacks: ['workforce-planning-rules'],
  associatedTables: ['workforce_plans', 'scenario_models'],
  invocationPattern: 'ASYNC',
  maxDurationMs: 5000,
  requiresCountryPolicyPack: false,
  requiresHumanReview: true,
  auditRequired: true,
});

/* ── 18. DEI, Pay Transparency & People Analytics ── */
engineRegistry.register({
  engineName: 'dei-pay-transparency-people-analytics',
  engineVersion: '1.4.0',
  description:
    'Checks pay-transparency reports and people-analytics outputs for DEI compliance.',
  inputTypes: ['PayTransparencyReport', 'DeiMetric', 'AnalyticsQuery'],
  outputDecisionCodes: ['COMPLIANT', 'NON_COMPLIANT', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['dei-pay-transparency-rules'],
  associatedTables: ['pay_transparency_reports', 'dei_metrics'],
  invocationPattern: 'ASYNC',
  maxDurationMs: 3000,
  requiresCountryPolicyPack: true,
  requiresHumanReview: true,
  auditRequired: true,
});

// dei-pay-transparency-people-analytics is registered as a definition above;
// this binds the concrete executable engine (sample-size / suppression /
// materiality-threshold compliance check over a computed pay-gap report).
export const deiPayTransparencyEngine = new DeiPayTransparencyEngine();

/* ── 19. Engagement, Recognition & 360 Feedback ── */
engineRegistry.register({
  engineName: 'engagement-recognition-360-feedback',
  engineVersion: '1.4.0',
  description:
    'Enforces anonymity thresholds, recognition budget caps, and feedback cycle rules.',
  inputTypes: ['EngagementSurvey', 'RecognitionEvent', 'FeedbackCycle'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['engagement-recognition-rules'],
  associatedTables: ['engagement_surveys', 'recognition_events', 'feedback_cycles'],
  invocationPattern: 'ASYNC',
  maxDurationMs: 2000,
  requiresCountryPolicyPack: false,
  requiresHumanReview: false,
  auditRequired: true,
});

/* ── 20. Union, Works-Council & Labor Relations ── */
engineRegistry.register({
  engineName: 'union-works-council-labor-relations',
  engineVersion: '1.4.0',
  description:
    'Validates collective-bargaining constraints, co-determination requirements, '
    + 'and works-council consultation rules.',
  inputTypes: ['CollectiveAgreement', 'WorksCouncilCase', 'LaborRelationEvent'],
  outputDecisionCodes: ['COMPLIANT', 'NON_COMPLIANT', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['works-council-rules', 'collective-bargaining-rules'],
  associatedTables: ['collective_agreements', 'works_council_cases'],
  invocationPattern: 'SAGA',
  maxDurationMs: 0,
  requiresCountryPolicyPack: true,
  requiresHumanReview: true,
  auditRequired: true,
});

/* ── 21. HR AI Governance ── */
engineRegistry.register({
  engineName: 'hr-ai-governance',
  engineVersion: '1.4.0',
  description:
    'Evaluates AI model cards, bias audits, and explainability requirements for HR ML pipelines.',
  inputTypes: ['ModelCard', 'BiasAuditReport', 'ExplainabilityLog'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['ai-governance-rules'],
  associatedTables: ['model_cards', 'bias_audits'],
  invocationPattern: 'ASYNC',
  maxDurationMs: 5000,
  requiresCountryPolicyPack: false,
  requiresHumanReview: true,
  auditRequired: true,
});

/* ── 22. Offboarding & Settlement ── */
engineRegistry.register({
  engineName: 'offboarding-settlement',
  engineVersion: '1.4.0',
  description:
    'Computes final settlements, notice-period obligations, and offboarding checklist compliance.',
  inputTypes: ['TerminationRequest', 'SettlementCalculation', 'OffboardingChecklist'],
  outputDecisionCodes: ['APPROVED', 'REJECTED', 'CONDITIONAL'],
  associatedRulePacks: ['offboarding-settlement-rules'],
  associatedTables: ['terminations', 'settlements', 'offboarding_checklists'],
  invocationPattern: 'SAGA',
  maxDurationMs: 0,
  requiresCountryPolicyPack: true,
  requiresHumanReview: true,
  auditRequired: true,
});

/* ── 23. Work Authorization & Immigration ── */
engineRegistry.register({
  engineName: 'work-authorization-immigration',
  engineVersion: '1.4.0',
  description:
    'Validates visa status, work-permit expiry, and right-to-work continuance.',
  inputTypes: ['VisaRecord', 'WorkPermit', 'ImmigrationStatus'],
  outputDecisionCodes: ['VALID', 'INVALID', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['immigration-compliance-rules'],
  associatedTables: ['visa_records', 'work_permits', 'immigration_statuses'],
  invocationPattern: 'SYNC',
  maxDurationMs: 200,
  requiresCountryPolicyPack: true,
  requiresHumanReview: false,
  auditRequired: true,
});

/* ── 24. I-9 / E-Verify ── */
engineRegistry.register({
  engineName: 'i9-everify',
  engineVersion: '1.4.0',
  description:
    'Ensures I-9 form completeness and E-Verify case compliance per USCIS regulations.',
  inputTypes: ['I9Form', 'EVerifyCase', 'WorkerProfile'],
  outputDecisionCodes: ['COMPLIANT', 'NON_COMPLIANT', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['i9-everify-compliance-rules'],
  associatedTables: ['i9_forms', 'everify_cases'],
  invocationPattern: 'SYNC',
  maxDurationMs: 300,
  requiresCountryPolicyPack: true,
  requiresHumanReview: false,
  auditRequired: true,
});

/* ── 25. Policy Acknowledgement & Compliance ── */
engineRegistry.register({
  engineName: 'policy-acknowledgement-compliance',
  engineVersion: '1.4.0',
  description:
    'Tracks policy acknowledgement status, deadlines, and escalation for non-compliance.',
  inputTypes: ['PolicyDocument', 'AcknowledgementRecord', 'ComplianceDeadline'],
  outputDecisionCodes: ['COMPLIANT', 'NON_COMPLIANT', 'REQUIRES_REVIEW'],
  associatedRulePacks: ['policy-acknowledgement-rules'],
  associatedTables: ['policy_documents', 'acknowledgements', 'compliance_deadlines'],
  invocationPattern: 'ASYNC',
  maxDurationMs: 1500,
  requiresCountryPolicyPack: false,
  requiresHumanReview: false,
  auditRequired: true,
});

/* ── 26. Field Access Policy (bonus, listed in dedicated file) ── */
engineRegistry.register({
  engineName: 'field-access-policy',
  engineVersion: '1.4.0',
  description:
    'Resolves field-level visibility based on data classification, actor roles, and declared purpose.',
  inputTypes: ['FieldPath', 'DataClassification', 'ActorRole', 'AbacContext', 'Purpose'],
  outputDecisionCodes: [
    'VISIBLE',
    'MASKED',
    'HIDDEN',
    'REQUIRES_STEP_UP',
    'REQUIRES_BREAK_GLASS',
    'DENIED',
  ],
  associatedRulePacks: ['field-classification-rules'],
  associatedTables: ['field_policies', 'data_classifications', 'actor_roles'],
  invocationPattern: 'SYNC',
  maxDurationMs: 50,
  requiresCountryPolicyPack: false,
  requiresHumanReview: false,
  auditRequired: true,
});

export const fieldAccessPolicyEngine = new FieldAccessPolicyEngine();

/* ── 27. Country Policy Validation ── */
engineRegistry.register({
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
});

export const countryPolicyValidationEngine = new CountryPolicyValidationEngine();

// offer-compensation is registered as a definition above; this binds the concrete
// executable engine (compa-ratio / range-penetration / statutory + pay-equity checks).
export const offerCompensationEngine = new OfferCompensationEngine();

// recruiting-fairness-compliance is registered as a definition above; this binds the
// concrete executable engine (EEOC 4/5ths-rule adverse-impact screening).
export const recruitingFairnessComplianceEngine = new RecruitingFairnessComplianceEngine();
