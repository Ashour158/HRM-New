import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { Kysely, Transaction } from 'kysely';
import { Uuid, AggregateRoot } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance, runWithTransaction } from '@hcm/database';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type {
  HrCommandEnvelope,
  CommandResult,
  CommandError,
  CommandOutcome,
} from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import type { TenantConfig } from '@hcm/platform-core';
import { TenantValidator, RedisCacheService, tenantResolver } from '@hcm/platform-core';
import { AccessControlService, type AccessControlDecision } from '@hcm/access-control';
import { FieldAccessDecision } from '@hcm/access-control';
import { selfServiceAuthorityEngine } from '@hcm/policy-engines';
import { EventBus } from '../event-bus/event-bus.js';
import { outboxMetadataForEvent } from '../outbox-inbox/outbox-event-envelope.js';
import type { FsmInstance } from '../workflow/fsm-framework.js';
import { FsmFramework } from '../workflow/fsm-framework.js';
import { TransitionLedgerService } from '../workflow/transition-ledger.js';
import { ApprovalWorkflowService } from '../workflow/approval-workflow.service.js';
import { HcmSetupService } from '../../domains/hcm-setup/hcm-setup.service.js';
import type {
  AllowedActionPolicyOverride,
  FieldAccessPolicyOverride,
  HcmPolicyScope,
  HcmSetupConfig,
  PolicyGovernanceConfig,
  RuntimePolicyRevisionEvidence,
  RuntimePolicyArea,
} from '../../domains/hcm-setup/hcm-setup.types.js';
import { COMMAND_HANDLER_METADATA } from './command-handler.decorator.js';

export interface CommandHandler {
  commandName: string;
  handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>>;
}

interface CommandPolicyDecisionEvidence {
  serviceArea: string;
  policyRevisionId?: string;
  engineName: string;
  engineVersion: string;
  scopeMatch: Record<string, unknown>;
  decision: 'ALLOWED' | 'DENIED';
  reason: string;
  commandName: string;
  aggregateType: string;
  subjectWorkerId?: string;
  sourceRecordId?: string;
  evaluatedPolicyRevisionIds?: string[];
  conflictingPolicyRevisionIds?: string[];
}

/** Minimal aggregate shell used by stepLoadAggregate for FSM checks. */
class LoadedAggregate extends AggregateRoot {}

type AggregateLoaderConfig = {
  table: string;
  stateColumn: 'status' | 'state';
  versionColumn: 'aggregate_version';
};

type AggregateStateRow = {
  id: string;
  aggregate_version?: number | string | bigint | null;
  status?: string | null;
  state?: string | null;
};

type ActorScopeClaims = {
  legalEntityIds?: string[];
  countryCodes?: string[];
  branchCodes?: string[];
  departmentIds?: string[];
  orgUnitIds?: string[];
  jobCodes?: string[];
  gradeCodes?: string[];
  locationCodes?: string[];
  employeeTypes?: string[];
  managerWorkerIds?: string[];
};

type GovernedCommandPolicyRule = {
  area: RuntimePolicyArea;
  aggregateTypes: string[];
  commandPatterns: RegExp[];
};

function aggregateLoader(table: string, stateColumn: 'status' | 'state' = 'status'): AggregateLoaderConfig {
  return { table, stateColumn, versionColumn: 'aggregate_version' };
}

const AGGREGATE_LOADERS: Record<string, AggregateLoaderConfig> = {
  WorkerProfile: aggregateLoader('workers'),
  EmploymentRelationship: aggregateLoader('employment_relationships', 'state'),
  JobAssignment: aggregateLoader('job_assignments', 'state'),
  EmploymentContract: aggregateLoader('employment_contracts', 'state'),
  PersonalDataRecord: aggregateLoader('personal_data_records', 'state'),

  position: aggregateLoader('hr_position.positions'),
  Position: aggregateLoader('hr_position.positions'),
  headcountRequest: aggregateLoader('hr_position.headcount_requests'),
  HeadcountRequest: aggregateLoader('hr_position.headcount_requests'),
  LegalEntity: aggregateLoader('hr_org.legal_entities'),
  OrgUnit: aggregateLoader('hr_org.org_units'),

  JobRequisition: aggregateLoader('hr_recruiting.job_requisitions'),
  Candidate: aggregateLoader('hr_recruiting.candidates'),
  InterviewPlan: aggregateLoader('hr_recruiting.interview_plans'),
  Offer: aggregateLoader('hr_recruiting.offers'),
  OnboardingPlan: aggregateLoader('hr_onboarding.onboarding_plans'),
  OnboardingTask: aggregateLoader('hr_onboarding.onboarding_tasks'),

  ApprovalChain: aggregateLoader('hr_workflow.approval_chains'),

  CompensationPlan: aggregateLoader('compensation_plans'),
  CompensationBand: aggregateLoader('compensation_bands'),
  CompensationChange: aggregateLoader('compensation_changes'),
  BonusCycle: aggregateLoader('bonus_cycles'),
  EquityGrant: aggregateLoader('equity_grants'),
  VariableCompPlan: aggregateLoader('variable_comp_plans'),
  PayScale: aggregateLoader('pay_scales'),
  TotalCompensationStatement: aggregateLoader('total_compensation_statements'),

  BenefitsProgram: aggregateLoader('benefits_programs'),
  BenefitsEnrollment: aggregateLoader('benefits_enrollments'),
  BenefitsLifeEvent: aggregateLoader('benefits_life_events'),
  SpendingAccount: aggregateLoader('spending_accounts'),
  CarrierReconciliationRun: aggregateLoader('carrier_reconciliation_runs'),

  PolicyDocument: aggregateLoader('hr_compliance.policy_documents'),
  PolicyAcknowledgement: aggregateLoader('hr_compliance.policy_acknowledgements'),
  LegalHold: aggregateLoader('hr_compliance.legal_holds'),
  StatutoryReport: aggregateLoader('hr_compliance.statutory_reports'),
  CountryRuleSet: aggregateLoader('hr_global_hr.country_rule_sets'),
  StatutoryLeaveType: aggregateLoader('hr_global_hr.statutory_leave_types'),
  WorksCouncilConsultation: aggregateLoader('hr_global_hr.works_council_consultations'),
  WorkAuthorizationCase: aggregateLoader('hr_global_hr.work_authorization_cases'),
  InternationalAssignment: aggregateLoader('hr_global_hr.international_assignments'),
  CountryPolicyPack: aggregateLoader('hr_country_policy.policy_packs'),
  CountryPolicyValidationRun: aggregateLoader('hr_country_policy.validation_runs'),
  CountryPolicyImpactSimulation: aggregateLoader('hr_country_policy.impact_simulations'),

  WorkSchedule: aggregateLoader('work_schedules'),
  Timesheet: aggregateLoader('timesheets'),
  TimeClockEvent: aggregateLoader('time_clock_events'),
  AttendanceException: aggregateLoader('attendance_exceptions'),
  AttendanceCorrectionRequest: aggregateLoader('attendance_correction_requests'),
  AttendanceDailyLedger: aggregateLoader('attendance_daily_ledgers'),
  OvertimeApproval: aggregateLoader('overtime_approvals'),

  AbsenceRequest: aggregateLoader('absence_requests'),
  LeaveCase: aggregateLoader('leave_cases'),
  AbsenceAccrualBalance: aggregateLoader('absence_accrual_balances'),
  LeaveEntitlementCalculation: aggregateLoader('leave_entitlement_calculations'),

  PayrollCycle: aggregateLoader('payroll_cycles'),
  PayrollInput: aggregateLoader('payroll_inputs'),
  PayrollCalculationRun: aggregateLoader('payroll_calculation_runs'),
  PayrollResultLine: aggregateLoader('payroll_result_lines'),
  PayrollPaymentBatch: aggregateLoader('payroll_payment_batches'),
  PayrollPayslipArtifact: aggregateLoader('payroll_payslip_artifacts'),
  PayrollExportJob: aggregateLoader('payroll_export_jobs'),
  PayrollGlPosting: aggregateLoader('payroll_gl_postings'),

  ShiftSchedule: aggregateLoader('shift_schedules'),
  OpenShift: aggregateLoader('open_shifts'),
  ShiftBid: aggregateLoader('shift_bids'),
  ShiftSwapRequest: aggregateLoader('shift_swap_requests'),
  WfmOvertimeApproval: aggregateLoader('wfm_overtime_approvals'),
  CoverageGap: aggregateLoader('coverage_gaps'),

  EmployeeRelationsCase: aggregateLoader('employee_relations_cases'),
  ErInvestigation: aggregateLoader('er_investigations'),
  DisciplinaryAction: aggregateLoader('disciplinary_actions'),
  AccommodationCase: aggregateLoader('accommodation_cases'),
  HrServiceCase: aggregateLoader('hr_service_cases'),
  HrCaseTask: aggregateLoader('hr_case_tasks'),
  HrKnowledgeArticle: aggregateLoader('hr_knowledge_articles'),
  HrServiceCatalogItem: aggregateLoader('hr_service_catalog_items'),
  HrCaseSlaInstance: aggregateLoader('hr_case_sla_instances'),

  ContingentWorkerAssignment: aggregateLoader('contingent_worker_assignments'),
  SowEngagement: aggregateLoader('sow_engagements'),
  ContractorRateCard: aggregateLoader('contractor_rate_cards'),
  MisclassificationAssessment: aggregateLoader('misclassification_assessments'),
  EapReferral: aggregateLoader('eap_referrals'),
  WellnessProgram: aggregateLoader('wellness_programs'),
  MentalHealthCase: aggregateLoader('mental_health_cases'),
  UnionRecognition: aggregateLoader('union_recognitions'),
  Grievance: aggregateLoader('grievances'),
  CollectiveBargainingSession: aggregateLoader('collective_bargaining_sessions'),

  ReportDefinition: aggregateLoader('hr_reporting.report_definitions'),
  ReportExecution: aggregateLoader('hr_reporting.report_executions'),
  ReportSchedule: aggregateLoader('hr_reporting.report_schedules'),
  CalculatedField: aggregateLoader('hr_reporting.calculated_fields'),
  DeiReport: aggregateLoader('hr_dei_analytics.dei_reports'),
  PayGapReport: aggregateLoader('hr_dei_analytics.pay_gap_reports'),
  PayEquityReview: aggregateLoader('hr_dei_analytics.pay_equity_reviews'),
  AttritionSegmentReport: aggregateLoader('hr_dei_analytics.attrition_segment_reports'),
  HrAiUseCase: aggregateLoader('hr_ai.hr_ai_use_cases'),
  HrAiModelRun: aggregateLoader('hr_ai.hr_ai_model_runs'),
  HrAiBiasTest: aggregateLoader('hr_ai.hr_ai_bias_tests'),
  HrAiKillSwitch: aggregateLoader('hr_ai.hr_ai_kill_switches'),

  LearningCourse: aggregateLoader('learning_courses'),
  LearningContentPackage: aggregateLoader('learning_content_packages'),
  LearningAssignment: aggregateLoader('learning_assignments'),
  Certification: aggregateLoader('certifications'),
  EngagementSurvey: aggregateLoader('engagement_surveys'),
  SurveyResponse: aggregateLoader('survey_responses'),
  Feedback360Cycle: aggregateLoader('hr_engagement.feedback_360_cycles'),
  RecognitionProgram: aggregateLoader('recognition_programs'),
  RecognitionRecord: aggregateLoader('recognition_records'),
  SkillProfile: aggregateLoader('skill_profiles'),
  TalentPool: aggregateLoader('talent_pools'),
  CareerPath: aggregateLoader('career_paths'),
  SuccessionPlan: aggregateLoader('succession_plans'),
  ReviewTemplate: aggregateLoader('review_templates'),
  PerformanceReview: aggregateLoader('performance_reviews'),
  PerformanceReviewCycle: aggregateLoader('performance_review_cycles'),
  PerformanceImprovementPlan: aggregateLoader('performance_improvement_plans'),
  DevelopmentPlan: aggregateLoader('development_plans'),
  Objective: aggregateLoader('objectives'),
  Competency: aggregateLoader('competencies'),
  KeyPerformanceIndicator: aggregateLoader('kpis'),
  KpiMeasurement: aggregateLoader('kpi_measurements'),
  CalibrationSession: aggregateLoader('calibration_sessions'),
  KeyResult: aggregateLoader('key_results'),
  Goal: aggregateLoader('goals'),
  PerformanceFeedback360Response: aggregateLoader('performance_feedback_360_responses'),
  PerformanceFeedback360Cycle: aggregateLoader('performance_feedback_360_cycles'),
};

export const GOVERNED_COMMAND_POLICY_MATRIX: GovernedCommandPolicyRule[] = [
  {
    area: 'EMPLOYEE_SETUP',
    aggregateTypes: ['WorkerProfile', 'EmploymentRelationship', 'JobAssignment', 'EmploymentContract', 'PersonalDataRecord'],
    commandPatterns: [/Worker/i, /Employment/i, /JobAssignment/i, /PersonalData/i],
  },
  {
    area: 'LEAVE',
    aggregateTypes: ['AbsenceRequest', 'LeaveCase', 'AbsenceAccrualBalance', 'LeaveEntitlementCalculation'],
    commandPatterns: [/Absence/i, /Leave/i],
  },
  {
    area: 'ATTENDANCE',
    aggregateTypes: ['TimeClockEvent', 'AttendanceException', 'AttendanceCorrectionRequest', 'AttendanceDailyLedger', 'Timesheet', 'WorkSchedule', 'OvertimeApproval'],
    commandPatterns: [/TimeClock/i, /Attendance/i, /Timesheet/i, /WorkSchedule/i, /Overtime/i],
  },
  {
    area: 'PAYROLL',
    aggregateTypes: ['PayrollCycle', 'PayrollInput', 'PayrollCalculationRun', 'PayrollResultLine', 'PayrollPaymentBatch', 'PayrollPayslipArtifact', 'PayrollExportJob', 'PayrollGlPosting'],
    commandPatterns: [/Payroll/i, /Payslip/i],
  },
  {
    area: 'ACCESS_GOVERNANCE',
    aggregateTypes: ['AccessGovernanceRole', 'AccessGovernancePermission', 'AccessReviewCampaign', 'AccessReviewItem', 'ServiceAccount'],
    commandPatterns: [/Role/i, /Permission/i, /AccessReview/i, /ServiceAccount/i, /Credential/i, /^CreateRole$/i],
  },
  {
    area: 'BENEFITS',
    aggregateTypes: ['BenefitsProgram', 'BenefitsEnrollment', 'BenefitsLifeEvent', 'SpendingAccount', 'CarrierReconciliationRun'],
    commandPatterns: [/Benefits/i, /SpendingAccount/i, /CarrierReconciliation/i],
  },
  {
    area: 'GLOBAL_HR',
    aggregateTypes: ['CountryRuleSet', 'StatutoryLeaveType', 'WorksCouncilConsultation', 'WorkAuthorizationCase', 'InternationalAssignment'],
    commandPatterns: [/CountryRuleSet/i, /StatutoryLeaveType/i, /WorksCouncil/i, /WorkAuthorization/i, /InternationalAssignment/i],
  },
  {
    area: 'DEI_ANALYTICS',
    aggregateTypes: ['DeiReport', 'PayGapReport', 'PayEquityReview', 'AttritionSegmentReport'],
    commandPatterns: [/Dei/i, /PayGap/i, /PayEquity/i, /AttritionSegment/i],
  },
  {
    area: 'ENGAGEMENT',
    aggregateTypes: ['EngagementSurvey', 'SurveyResponse', 'Feedback360Cycle', 'RecognitionProgram', 'RecognitionRecord'],
    commandPatterns: [/Engagement/i, /SurveyResponse/i, /Feedback360/i, /Recognition/i],
  },
  {
    area: 'COUNTRY_POLICY',
    aggregateTypes: ['CountryPolicyPack', 'CountryPolicyValidationRun', 'CountryPolicyImpactSimulation'],
    commandPatterns: [/CountryPolicy/i],
  },
  {
    area: 'COMPLIANCE',
    aggregateTypes: ['PolicyDocument', 'PolicyAcknowledgement', 'LegalHold', 'StatutoryReport'],
    commandPatterns: [/PolicyDocument/i, /PolicyAcknowledgement/i, /LegalHold/i, /StatutoryReport/i, /Compliance/i],
  },
  {
    area: 'ACCESS_GOVERNANCE',
    aggregateTypes: [],
    // Every business command must at least pass applied access governance.
    commandPatterns: [/^(Accept|Achieve|Acknowledge|Activate|Add|Analyze|Appeal|Apply|Approve|Arbitrate|Archive|Arm|Assign|Award|Breach|Calculate|Calibrate|Cancel|Clear|Close|Complete|Configure|Create|Deactivate|Deprecate|Dispute|Draft|End|Enroll|Enter|Execute|Exempt|Expire|Extend|Fail|Fill|Finalize|Flag|Freeze|Generate|Implement|Investigate|Launch|Mark|Meet|Move|Negotiate|Notify|Open|Parse|Pause|Plan|Publish|Queue|Ratify|Rearm|Record|Register|Reject|Remove|Renew|Resolve|Restructure|Retire|Review|Revise|Revoke|Run|Schedule|Screen|Send|Setup|Simulate|Skip|Start|Submit|Suspend|Terminate|Trigger|Unfreeze|Update|Uphold|Vacate|Validate|Withdraw)/i],
  },
];

export function requiredPolicyAreaForCommand(command: Pick<HrCommandEnvelope<unknown>, 'aggregateType' | 'commandName'>): RuntimePolicyArea | undefined {
  return GOVERNED_COMMAND_POLICY_MATRIX.find((rule) => (
    rule.aggregateTypes.includes(command.aggregateType)
    || rule.commandPatterns.some((pattern) => pattern.test(command.commandName))
  ))?.area;
}

const SENSITIVE_FIELD_RULES: Array<{
  policyField: string;
  dataClassification: 'HIGH_SENSITIVITY' | 'SPECIAL_CATEGORY' | 'LEGAL_HOLD';
  allowedWriterRoles: string[];
  patterns: RegExp[];
}> = [
  {
    policyField: 'worker.compensation.salary',
    dataClassification: 'HIGH_SENSITIVITY',
    allowedWriterRoles: ['HR_ADMIN', 'PAYROLL_ADMIN', 'COMPENSATION_ADMIN', 'SUPER_ADMIN'],
    patterns: [/salary/i, /gross/i, /net/i, /taxAmount/i, /insuranceAmount/i, /deduction/i, /payroll/i],
  },
  {
    policyField: 'worker.compensation.bankAccount',
    dataClassification: 'HIGH_SENSITIVITY',
    allowedWriterRoles: ['PAYROLL_ADMIN', 'HR_ADMIN', 'SUPER_ADMIN'],
    patterns: [/bank/i, /iban/i, /accountNumber/i, /routingNumber/i, /swift/i],
  },
  {
    policyField: 'worker.ssn',
    dataClassification: 'SPECIAL_CATEGORY',
    allowedWriterRoles: ['HR_ADMIN', 'PAYROLL_ADMIN', 'COMPLIANCE_OFFICER', 'LEGAL', 'SUPER_ADMIN'],
    patterns: [/ssn/i, /nationalId/i, /passport/i, /taxIdentifier/i, /socialInsurance/i],
  },
  {
    policyField: 'worker.medicalInfo',
    dataClassification: 'SPECIAL_CATEGORY',
    allowedWriterRoles: ['BENEFITS_ADMIN', 'HR_ADMIN', 'COMPLIANCE_OFFICER', 'SUPER_ADMIN'],
    patterns: [/medical/i, /health/i, /disability/i, /accommodation/i],
  },
  {
    policyField: 'worker.diversityData',
    dataClassification: 'SPECIAL_CATEGORY',
    allowedWriterRoles: ['COMPLIANCE_OFFICER', 'HR_ADMIN', 'SUPER_ADMIN'],
    patterns: [/gender/i, /diversity/i, /ethnicity/i, /religion/i],
  },
  {
    policyField: 'worker.legalHoldNotes',
    dataClassification: 'LEGAL_HOLD',
    allowedWriterRoles: ['LEGAL', 'COMPLIANCE_OFFICER', 'SUPER_ADMIN'],
    patterns: [/legalHold/i, /retentionHold/i],
  },
];

@Injectable()
export class CommandBus implements OnModuleInit {
  private readonly handlers = new Map<string, CommandHandler>();
  private readonly db: Kysely<Database>;
  private readonly tenantValidator: TenantValidator;
  private readonly logger = new Logger(CommandBus.name);

  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RedisCacheService) private readonly redisCache: RedisCacheService,
    @Inject(AccessControlService) private readonly accessControl: AccessControlService,
    @Inject(FsmFramework) private readonly fsmFramework: FsmFramework,
    @Inject(TransitionLedgerService) private readonly transitionLedger: TransitionLedgerService,
    @Inject(EventBus) _eventBus: EventBus,
    @Optional() @Inject(HcmSetupService) private readonly hcmSetup?: Pick<HcmSetupService, 'getSetup'>,
    @Optional() @Inject(ApprovalWorkflowService) private readonly approvalWorkflow?: ApprovalWorkflowService,
  ) {
    this.db = createKyselyInstance(getPool());
    this.tenantValidator = new TenantValidator(this.db);
  }

  onModuleInit(): void {
    const providers = this.discovery.getProviders();
    for (const wrapper of providers) {
      const instance = wrapper.instance;
      if (!instance) continue;
      const commandName = this.reflector.get<string>(COMMAND_HANDLER_METADATA, instance.constructor);
      if (commandName) {
        this.handlers.set(commandName, instance as CommandHandler);
      }
    }
    this.approvalWorkflow?.bindCommandExecutor((command) => this.execute(command));
  }

  registerHandler(commandName: string, handler: CommandHandler): void {
    this.handlers.set(commandName, handler);
  }

  async execute<TPayload, TResult>(
    command: HrCommandEnvelope<TPayload>,
  ): Promise<CommandOutcome<TResult>> {
    const startedAt = Date.now();
    const trx = await this.db.transaction().execute(async (_tx) => {
      let step = CommandPipelineStep.AUTHENTICATE_ACTOR;
      let policyDecisionEvidence: CommandPolicyDecisionEvidence | undefined;
      try {
        step = CommandPipelineStep.AUTHENTICATE_ACTOR;
        await this.stepAuthenticateActor(command);

        step = CommandPipelineStep.RESOLVE_TENANT;
        const tenantConfig = await this.stepResolveTenant(command);

        step = CommandPipelineStep.VALIDATE_TENANT_MODULE_ENABLED;
        await this.stepValidateTenantModule(command, tenantConfig);

        step = CommandPipelineStep.VALIDATE_COMMAND_SCHEMA;
        await this.stepValidateSchema(command);

        step = CommandPipelineStep.FAST_IDEMPOTENCY_LOOKUP;
        const existing = await this.stepFastIdempotencyLookup(command);
        if (existing) {
          return existing as CommandOutcome<TResult>;
        }

        step = CommandPipelineStep.RESERVE_IDEMPOTENCY_KEY;
        await this.stepReserveIdempotencyKey(_tx, command);

        step = CommandPipelineStep.REJECT_SAME_KEY_DIFFERENT_HASH;
        await this.stepRejectHashMismatch(_tx, command);

        step = CommandPipelineStep.LOAD_AGGREGATE_WITH_LOCK;
        const aggregate = await this.stepLoadAggregate(_tx, command);

        step = CommandPipelineStep.VALIDATE_TENANT_SUBJECT_WORKER_ACCESS;
        await this.stepValidateSubjectWorkerAccess(command);

        step = CommandPipelineStep.EVALUATE_HR_DATA_PRIVACY_FIELD_POLICY;
        await this.stepEvaluateFieldPolicy(command);

        step = CommandPipelineStep.EVALUATE_COMMAND_AUTHORIZATION_ROLE_SCOPE;
        const rbacDecision = await this.evaluateRbacDecision(command);

        step = CommandPipelineStep.EVALUATE_COMMAND_AUTHORIZATION_ROLE_SCOPE;
        await this.stepEvaluateRuntimeAccessGovernance(command);

        step = CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE;
        policyDecisionEvidence = await this.stepEnforceAppliedPolicyRevision(command);

        step = CommandPipelineStep.EVALUATE_MANAGER_HRBP_RELATIONSHIP;
        await this.stepEvaluateManagerRelationship(command);

        step = CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE;
        await this.stepEvaluatePolicyEngine(command);

        step = CommandPipelineStep.EVALUATE_WORKFLOW_GUARD_EXPECTED_STATE_VERSION_EFFECTIVE_DATE;
        await this.stepEvaluateFsm(command, aggregate);

        step = CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE;
        await this.stepEvaluateLegalAndPolicy(command);

        step = CommandPipelineStep.EVALUATE_SOD_POLICY;
        await this.stepEvaluateSoD(command);

        step = CommandPipelineStep.PERFORM_DOMAIN_TRANSITION_THROUGH_AGGREGATE_METHOD;
        const approvalResult = await this.approvalWorkflow?.gateCommand(
          command,
          ((await this.getRuntimeSetup(command)) ?? {}) as HcmSetupConfig,
          rbacDecision,
        );
        if (approvalResult) {
          const completedPolicyDecisionEvidence = this.completePolicyDecisionEvidence(policyDecisionEvidence, approvalResult);
          const auditRecordId = await this.stepWriteAuditRecord(_tx, command, approvalResult, completedPolicyDecisionEvidence);
          await this.stepWriteOutbox(_tx, command, approvalResult, completedPolicyDecisionEvidence);
          await this.stepWritePolicyDecisionEvidence(_tx, command, approvalResult, completedPolicyDecisionEvidence);
          const enriched = {
            ...approvalResult,
            auditRecordId,
            policyDecisionEvidence: completedPolicyDecisionEvidence ? [completedPolicyDecisionEvidence] : [],
          } as unknown as CommandResult<TResult>;
          await this.stepStoreIdempotencyResult(_tx, command, enriched);
          return enriched as CommandOutcome<TResult>;
        }

        const handler = this.handlers.get(command.commandName);
        if (!handler) {
          throw this.makeError(
            command,
            step,
            'COMMAND_HANDLER_NOT_FOUND',
            `No handler registered for command ${command.commandName}`,
            false,
          );
        }
        const result = await runWithTransaction(_tx, () => handler.handle(command as HrCommandEnvelope<unknown>));
        const completedPolicyDecisionEvidence = this.completePolicyDecisionEvidence(policyDecisionEvidence, result);

        step = CommandPipelineStep.WRITE_AUTHORITATIVE_STATE;
        await this.stepWriteState(_tx, command, result);

        step = CommandPipelineStep.WRITE_TRANSITION_LEDGER;
        await this.stepWriteTransitionLedger(_tx, command, result);

        step = CommandPipelineStep.WRITE_HR_AUDIT_RECORD;
        const auditRecordId = await this.stepWriteAuditRecord(_tx, command, result, completedPolicyDecisionEvidence);

        step = CommandPipelineStep.WRITE_OUTBOX_EVENT;
        await this.stepWriteOutbox(_tx, command, result, completedPolicyDecisionEvidence);

        await this.stepWritePolicyDecisionEvidence(_tx, command, result, completedPolicyDecisionEvidence);

        const enriched = {
          ...result,
          auditRecordId,
          policyDecisionEvidence: completedPolicyDecisionEvidence ? [completedPolicyDecisionEvidence] : [],
        } as unknown as CommandResult<TResult>;

        step = CommandPipelineStep.STORE_IDEMPOTENCY_RESULT;
        await this.stepStoreIdempotencyResult(_tx, command, enriched);

        step = CommandPipelineStep.COMMIT_TRANSACTION;

        step = CommandPipelineStep.RETURN_COMMAND_RESULT_WITH_ALLOWED_NEXT_ACTIONS_AND_FIELD_FILTERED_DATA;
        this.logger.log({
          eventType: 'COMMAND_SUCCEEDED',
          commandName: command.commandName,
          aggregateType: command.aggregateType,
          aggregateId: command.aggregateId?.value,
          tenantId: command.tenantId.value,
          actorId: command.actor.actorId.value,
          actorType: command.actor.actorType,
          correlationId: command.correlationId,
          durationMs: Date.now() - startedAt,
        });
        return enriched as CommandOutcome<TResult>;
      } catch (err) {
        const originalError = err instanceof Error ? err.message : String(err);
        this.logger.error({
          eventType: 'COMMAND_FAILED',
          commandName: command.commandName,
          aggregateType: command.aggregateType,
          aggregateId: command.aggregateId?.value,
          tenantId: command.tenantId.value,
          // Optional chaining: if the failure originated in stepAuthenticateActor (the
          // pipeline's first step), command.actor may be malformed/undefined - an
          // unguarded dereference here would throw a second error while trying to log
          // the first one, masking the real failure entirely.
          actorId: command.actor?.actorId?.value,
          actorType: command.actor?.actorType,
          correlationId: command.correlationId,
          stepFailed: step,
          durationMs: Date.now() - startedAt,
          message: originalError,
        });
        if (this.isCommandError(err)) {
          try {
            await this.stepStoreIdempotencyError(_tx, command, err);
          } catch (storeErr) {
            this.logger.error({
              eventType: 'COMMAND_IDEMPOTENCY_ERROR_STORE_FAILED',
              commandName: command.commandName,
              correlationId: command.correlationId,
              message: storeErr instanceof Error ? storeErr.message : String(storeErr),
            });
          }
          return err as CommandOutcome<TResult>;
        }
        const cmdError = this.makeError(
          command,
          step,
          'COMMAND_EXECUTION_ERROR',
          originalError,
          step < CommandPipelineStep.WRITE_AUTHORITATIVE_STATE,
        );
        try {
          await this.stepStoreIdempotencyError(_tx, command, cmdError);
        } catch (storeErr) {
          this.logger.error({
            eventType: 'COMMAND_IDEMPOTENCY_ERROR_STORE_FAILED',
            commandName: command.commandName,
            correlationId: command.correlationId,
            message: storeErr instanceof Error ? storeErr.message : String(storeErr),
          });
        }
        return cmdError as CommandOutcome<TResult>;
      }
    });

    return trx;
  }

  private makeError(
    command: HrCommandEnvelope<unknown>,
    step: CommandPipelineStep,
    errorCode: string,
    errorMessage: string,
    retryable: boolean,
    errorDetails?: CommandError['errorDetails'],
  ): CommandError {
    return {
      success: false,
      errorCode,
      errorMessage,
      errorDetails,
      commandId: command.commandId,
      correlationId: command.correlationId,
      stepFailed: step,
      retryable,
    };
  }

  private isCommandError(err: unknown): err is CommandError {
    return typeof err === 'object' && err !== null && 'success' in err && err.success === false;
  }

  private async stepAuthenticateActor(command: HrCommandEnvelope<unknown>): Promise<void> {
    const actorId = this.readUuidValue(command.actor?.actorId);
    const actorType = command.actor?.actorType;
    const validActorTypes = ['USER', 'SYSTEM', 'SERVICE_ACCOUNT', 'INTEGRATION'];
    if (!actorType || !validActorTypes.includes(actorType) || !actorId || !Uuid.isValid(actorId)) {
      throw this.makeError(
        command,
        CommandPipelineStep.AUTHENTICATE_ACTOR,
        'UNAUTHENTICATED_ACTOR',
        'Command actor must be authenticated with a valid UUID actor id',
        false,
      );
    }
    if (!Array.isArray(command.actor.roles) || command.actor.roles.length === 0) {
      throw this.makeError(
        command,
        CommandPipelineStep.AUTHENTICATE_ACTOR,
        'UNAUTHENTICATED_ACTOR',
        'Command actor must have at least one role',
        false,
      );
    }
  }

  private async stepResolveTenant(command: HrCommandEnvelope<unknown>): Promise<TenantConfig> {
    const request = { headers: { 'x-tenant-id': command.tenantId.value } };
    const result = await tenantResolver.resolve(request);
    if (result.isErr()) {
      throw this.makeError(command, CommandPipelineStep.RESOLVE_TENANT, 'TENANT_RESOLUTION_FAILED', (result as { error: { message: string } }).error.message, false);
    }
    const config = await this.tenantValidator.getTenantConfig(command.tenantId);
    if (!config) {
      throw this.makeError(command, CommandPipelineStep.RESOLVE_TENANT, 'TENANT_NOT_FOUND', 'Tenant configuration not found', false);
    }
    return config;
  }

  private async stepValidateTenantModule(
    command: HrCommandEnvelope<unknown>,
    tenantConfig: TenantConfig,
  ): Promise<void> {
    if (tenantConfig.status !== 'ACTIVE') {
      throw this.makeError(command, CommandPipelineStep.VALIDATE_TENANT_MODULE_ENABLED, 'TENANT_INACTIVE', 'Tenant is not active', false);
    }
    const moduleCode = command.aggregateType.toUpperCase();
    if (tenantConfig.enabledModules.length > 0 && !tenantConfig.enabledModules.includes(moduleCode)) {
      throw this.makeError(command, CommandPipelineStep.VALIDATE_TENANT_MODULE_ENABLED, 'MODULE_DISABLED', `Module ${moduleCode} is not enabled`, false);
    }
  }

  private async stepValidateSchema(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (command.payload === undefined || command.payload === null) {
      throw this.makeError(command, CommandPipelineStep.VALIDATE_COMMAND_SCHEMA, 'INVALID_PAYLOAD', 'Command payload is required', false);
    }
  }

  private async stepFastIdempotencyLookup(
    command: HrCommandEnvelope<unknown>,
  ): Promise<CommandOutcome<unknown> | undefined> {
    const cacheKey = `idempotency:${command.tenantId.value}:${command.idempotencyKey}`;
    const cached = await this.redisCache.get<CommandOutcome<unknown>>(cacheKey);
    return cached;
  }

  private async stepReserveIdempotencyKey(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
  ): Promise<void> {
    const requestHash = command.metadata.requestHash;
    await tx
      .insertInto('idempotency_keys')
      .values({
        id: crypto.randomUUID(),
        tenant_id: command.tenantId.value,
        key: command.idempotencyKey,
        hash: requestHash,
        status: 'PENDING',
        command_name: command.commandName,
        aggregate_type: command.aggregateType,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  private async stepRejectHashMismatch(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
  ): Promise<void> {
    const existing = await tx
      .selectFrom('idempotency_keys')
      .select(['hash'])
      .where('tenant_id', '=', command.tenantId.value)
      .where('key', '=', command.idempotencyKey)
      .executeTakeFirst();

    if (existing && existing.hash !== command.metadata.requestHash) {
      throw this.makeError(
        command,
        CommandPipelineStep.REJECT_SAME_KEY_DIFFERENT_HASH,
        'IDEMPOTENCY_HASH_MISMATCH',
        'Idempotency key exists with different request hash',
        false,
      );
    }
  }

  private async stepLoadAggregate(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
  ): Promise<AggregateRoot | undefined> {
    if (!command.aggregateId) {
      return undefined;
    }

    const loader = this.resolveAggregateLoader(command.aggregateType);

    const row = await this.selectAggregateState(tx, loader, command);
    if (!row) {
      return undefined;
    }
    const loadedState = row[loader.stateColumn];
    if (command.expectedState && loadedState && loadedState !== command.expectedState) {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_WORKFLOW_GUARD_EXPECTED_STATE_VERSION_EFFECTIVE_DATE,
        'AGGREGATE_STATE_CONFLICT',
        `Expected aggregate state ${command.expectedState}, found ${loadedState}`,
        false,
      );
    }

    const aggregate = new LoadedAggregate(new Uuid(row.id));
    aggregate.restoreVersion(Number(row.aggregate_version ?? 0));
    return aggregate;
  }

  private async stepValidateSubjectWorkerAccess(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (!command.subjectWorkerId) return;
    if (command.actor.actorType === 'SYSTEM' || command.actor.actorType === 'SERVICE_ACCOUNT' || command.actor.actorType === 'INTEGRATION') return;
    if (command.actor.roles.some((role) => ['HR_ADMIN', 'HRBP', 'PAYROLL_ADMIN', 'SUPER_ADMIN'].includes(role))) return;
    if (command.actor.actorId.value === command.subjectWorkerId.value) {
      const self = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('id', '=', command.subjectWorkerId.value)
        .where('tenant_id', '=', command.tenantId.value)
        .executeTakeFirst();
      if (self) return;
    }
    if (command.actor.roles.includes('MANAGER')) {
      const report = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('id', '=', command.subjectWorkerId.value)
        .where('tenant_id', '=', command.tenantId.value)
        .where('manager_id', '=', command.actor.actorId.value)
        .executeTakeFirst();
      if (report) return;
    }
    const actorEmail = (command.actor as { email?: string }).email;
    if (actorEmail && command.actor.roles.includes('MANAGER')) {
      const manager = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('email', '=', actorEmail)
        .where('tenant_id', '=', command.tenantId.value)
        .executeTakeFirst();
      if (manager) {
        const report = await this.db
          .selectFrom('workers')
          .select(['id'])
          .where('id', '=', command.subjectWorkerId.value)
          .where('tenant_id', '=', command.tenantId.value)
          .where('manager_id', '=', manager.id)
          .executeTakeFirst();
        if (report) return;
      }
    }
    if (actorEmail) {
      const self = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('id', '=', command.subjectWorkerId.value)
        .where('tenant_id', '=', command.tenantId.value)
        .where('email', '=', actorEmail)
        .executeTakeFirst();
      if (self) return;
    }

    throw this.makeError(
      command,
      CommandPipelineStep.VALIDATE_TENANT_SUBJECT_WORKER_ACCESS,
      'SUBJECT_WORKER_ACCESS_DENIED',
      'Employee self-service commands can only target the authenticated employee',
      false,
    );
  }

  private async stepEvaluateFieldPolicy(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (command.actor.actorType === 'SYSTEM' || command.actor.actorType === 'SERVICE_ACCOUNT') {
      return;
    }

    const payloadPaths = this.flattenPayloadPaths(command.payload);
    const denied: string[] = [];
    for (const rule of SENSITIVE_FIELD_RULES) {
      const matched = payloadPaths.some((path) => rule.patterns.some((pattern) => pattern.test(path)));
      if (!matched) continue;
      const roleAllowed = command.actor.roles.some((role) => rule.allowedWriterRoles.includes(role));
      const fieldDecision = this.accessControl.evaluateFieldAccess(
        rule.policyField,
        command.actor.roles,
        {
          isSelf: false,
          isManager: command.actor.roles.includes('MANAGER'),
          isManagerChain: false,
          isPeer: false,
          legalEntityIds: [],
          countryCodes: [],
          departmentIds: [],
          timeOfAccess: new Date(),
          breakGlassActive: Boolean(command.actor.breakGlassSessionId),
          mfaAuthenticated: command.actor.mfaAuthenticated,
        },
        rule.dataClassification,
      );
      const breakGlassAllowed =
        fieldDecision.decision === FieldAccessDecision.REQUIRES_BREAK_GLASS &&
        Boolean(command.actor.breakGlassSessionId);
      if (!roleAllowed && fieldDecision.decision !== FieldAccessDecision.VISIBLE && !breakGlassAllowed) {
        denied.push(rule.policyField);
      }
    }

    if (denied.length > 0) {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_HR_DATA_PRIVACY_FIELD_POLICY,
        'FIELD_POLICY_DENIED',
        `Field policy denied mutation of ${[...new Set(denied)].join(', ')}`,
        false,
      );
    }

  }

  async stepEvaluateRbac(command: HrCommandEnvelope<unknown>): Promise<void> {
    await this.evaluateRbacDecision(command);
  }

  private async evaluateRbacDecision(command: HrCommandEnvelope<unknown>): Promise<AccessControlDecision> {
    const actorType = this.mapActorType(command.actor.actorType, command.actor.roles);
    const acCommand = {
      commandName: command.commandName,
      commandType: this.inferCommandType(command.commandName),
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      payload: command.payload as Record<string, unknown>,
    };
    const acActor = {
      workerId: command.actor.actorId,
      roles: command.actor.roles,
      actorType,
      employmentStatus: await this.resolveActorEmploymentStatus(command, actorType),
    };
    const decision = this.accessControl.evaluateCommandAccess(acCommand, acActor);
    if (!decision.allowed) {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_COMMAND_AUTHORIZATION_ROLE_SCOPE,
        'ACCESS_CONTROL_DENIED',
        decision.reason ?? 'Access control denied',
        false,
      );
    }

    return decision;
  }

  private async stepEvaluateRuntimeAccessGovernance(command: HrCommandEnvelope<unknown>): Promise<void> {
    await this.stepEvaluateRuntimeAllowedActionOverrides(command);
    await this.stepEvaluateRuntimeFieldAccessOverrides(command);
  }

  private async stepEnforceAppliedPolicyRevision(command: HrCommandEnvelope<unknown>): Promise<CommandPolicyDecisionEvidence | undefined> {
    if (command.actor.actorType === 'SYSTEM') return undefined;
    if (command.aggregateType === 'ApprovalChain') return undefined;

    const requiredArea = requiredPolicyAreaForCommand(command);
    if (!requiredArea) return undefined;

    const setup = await this.getRuntimeSetup(command);
    const revisions = setup?.runtimePolicyRevisions ?? [];
    const matching = revisions.filter((candidate) => (
      candidate.area === requiredArea
      && candidate.status === 'APPLIED'
      && this.policyScopeMatches(candidate.scope, command)
    ));
    if (matching.length >= 1) {
      const highestSpecificity = Math.max(...matching.map((candidate) => this.policyScopeSpecificity(candidate.scope)));
      const mostSpecific = matching.filter((candidate) => this.policyScopeSpecificity(candidate.scope) === highestSpecificity);
      if (mostSpecific.length === 1) {
        return this.buildAllowedPolicyDecisionEvidence(command, requiredArea, mostSpecific[0], matching);
      }

      const conflictingPolicyRevisionIds = mostSpecific.map((candidate) => candidate.revisionId);
      const reason = `${requiredArea} command ${command.commandName} has conflicting applied Policy Center revisions at the same scope precedence: ${conflictingPolicyRevisionIds.join(', ')}.`;
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE,
        'CONFLICTING_POLICY_REVISIONS_APPLIED',
        reason,
        false,
        {
          policyDecisionEvidence: this.buildDeniedPolicyDecisionEvidence(
            command,
            requiredArea,
            reason,
            revisions,
            mostSpecific,
          ),
        },
      );
    }

    const sameAreaRevisions = revisions.filter((candidate) => candidate.area === requiredArea);
    const reason = `${requiredArea} commands require an applied Policy Center revision before ${command.commandName} can execute.`;
    throw this.makeError(
      command,
      CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE,
      'REQUIRED_POLICY_REVISION_NOT_APPLIED',
      reason,
      false,
      {
        policyDecisionEvidence: this.buildDeniedPolicyDecisionEvidence(command, requiredArea, reason, sameAreaRevisions),
      },
    );
  }

  private buildAllowedPolicyDecisionEvidence(
    command: HrCommandEnvelope<unknown>,
    serviceArea: RuntimePolicyArea,
    revision: RuntimePolicyRevisionEvidence,
    evaluatedRevisions: RuntimePolicyRevisionEvidence[] = [revision],
  ): CommandPolicyDecisionEvidence {
    const subjectWorkerId = this.resolveSubjectWorkerId(command)?.value;
    return {
      serviceArea,
      policyRevisionId: revision.revisionId,
      engineName: revision.engineName,
      engineVersion: revision.engineVersion,
      scopeMatch: this.policyScopeEvidence(revision.scope, command),
      decision: 'ALLOWED',
      reason: `Applied Policy Center revision ${revision.revisionId} authorizes ${command.commandName}.`,
      commandName: command.commandName,
      aggregateType: command.aggregateType,
      subjectWorkerId,
      sourceRecordId: command.aggregateId?.value ?? subjectWorkerId,
      evaluatedPolicyRevisionIds: evaluatedRevisions.map((candidate) => candidate.revisionId),
    };
  }

  private buildDeniedPolicyDecisionEvidence(
    command: HrCommandEnvelope<unknown>,
    serviceArea: RuntimePolicyArea,
    reason: string,
    evaluatedRevisions: RuntimePolicyRevisionEvidence[],
    conflictingRevisions: RuntimePolicyRevisionEvidence[] = [],
  ): CommandPolicyDecisionEvidence {
    const subjectWorkerId = this.resolveSubjectWorkerId(command)?.value;
    const firstRevision = conflictingRevisions[0] ?? evaluatedRevisions[0];
    return {
      serviceArea,
      engineName: firstRevision?.engineName ?? 'PolicyApplicationEngine',
      engineVersion: firstRevision?.engineVersion ?? 'unapplied',
      scopeMatch: this.policyScopeEvidence(firstRevision?.scope, command),
      decision: 'DENIED',
      reason,
      commandName: command.commandName,
      aggregateType: command.aggregateType,
      subjectWorkerId,
      sourceRecordId: command.aggregateId?.value ?? subjectWorkerId,
      evaluatedPolicyRevisionIds: evaluatedRevisions.map((candidate) => candidate.revisionId),
      conflictingPolicyRevisionIds: conflictingRevisions.map((candidate) => candidate.revisionId),
    };
  }

  private completePolicyDecisionEvidence(
    evidence: CommandPolicyDecisionEvidence | undefined,
    result: CommandResult<unknown>,
  ): CommandPolicyDecisionEvidence | undefined {
    if (!evidence) return undefined;
    return {
      ...evidence,
      sourceRecordId: evidence.sourceRecordId ?? result.aggregateId.value,
    };
  }

  private policyScopeEvidence(
    scope: HcmPolicyScope | undefined,
    command: HrCommandEnvelope<unknown>,
  ): Record<string, unknown> {
    return {
      tenantId: command.tenantId.value,
      ...(scope ?? {}),
    };
  }

  private async stepEvaluateRuntimeAllowedActionOverrides(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (command.actor.actorType === 'SYSTEM' || command.actor.actorType === 'SERVICE_ACCOUNT') {
      return;
    }

    const governance = await this.getRuntimeGovernance(command);
    if (!governance) return;

    const blockedAction = governance.allowedActionOverrides?.find((candidate) => (
      candidate.effect === 'HIDE' && this.allowedActionOverrideMatches(candidate, command)
    ));
    if (blockedAction) {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_COMMAND_AUTHORIZATION_ROLE_SCOPE,
        'RUNTIME_POLICY_ACTION_DENIED',
        blockedAction.reason ?? `Applied access policy hides or denies ${command.commandName} for ${command.aggregateType}`,
        false,
      );
    }
  }

  private async stepEvaluateRuntimeFieldAccessOverrides(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (command.actor.actorType === 'SYSTEM' || command.actor.actorType === 'SERVICE_ACCOUNT') {
      return;
    }

    const governance = await this.getRuntimeGovernance(command);
    if (!governance) return;

    const payloadPaths = this.flattenPayloadPaths(command.payload);
    const blockedField = governance.fieldAccessOverrides?.find((candidate) => (
      this.fieldAccessOverrideBlocksWrite(candidate, command, payloadPaths)
    ));
    if (!blockedField) return;

    throw this.makeError(
      command,
      CommandPipelineStep.EVALUATE_HR_DATA_PRIVACY_FIELD_POLICY,
      'RUNTIME_POLICY_FIELD_DENIED',
      blockedField.reason ?? `Applied field access policy denies mutation of ${blockedField.fieldPath}`,
      false,
    );
  }

  private async getRuntimeGovernance(command: HrCommandEnvelope<unknown>): Promise<PolicyGovernanceConfig | undefined> {
    return (await this.getRuntimeSetup(command))?.policyGovernance;
  }

  private async getRuntimeSetup(command: HrCommandEnvelope<unknown>): Promise<Partial<HcmSetupConfig> | undefined> {
    if (this.hcmSetup) {
      return this.hcmSetup.getSetup(command.tenantId);
    }
    if (!this.db) return undefined;

    const row = await this.db
      .selectFrom('hcm_setup_configs')
      .select(['config'])
      .where('tenant_id', '=', command.tenantId.value)
      .executeTakeFirst();
    return row?.config as Partial<HcmSetupConfig> | undefined;
  }

  private allowedActionOverrideMatches(
    override: AllowedActionPolicyOverride,
    command: HrCommandEnvelope<unknown>,
  ): boolean {
    return Boolean(
      override.active
      && this.aggregateTypeMatches(override.aggregateType, command.aggregateType)
      && this.commandActionMatches(override.action, command)
      && this.rolesMatch(override.roles, command.actor.roles)
      && this.policyScopeMatches(override.scope, command),
    );
  }

  private fieldAccessOverrideBlocksWrite(
    override: FieldAccessPolicyOverride,
    command: HrCommandEnvelope<unknown>,
    payloadPaths: string[],
  ): boolean {
    return Boolean(
      override.active
      && this.fieldDecisionBlocksWrite(override, command)
      && this.aggregateTypeMatches(override.resourceType, command.aggregateType)
      && this.rolesMatch(override.roles, command.actor.roles)
      && this.policyScopeMatches(override.scope, command)
      && payloadPaths.some((path) => this.fieldPathMatchesOverride(path, override.fieldPath)),
    );
  }

  private fieldDecisionBlocksWrite(
    override: FieldAccessPolicyOverride,
    command: HrCommandEnvelope<unknown>,
  ): boolean {
    if (override.decision === 'DENIED' || override.decision === 'HIDDEN') return true;
    if (override.decision === 'REQUIRES_BREAK_GLASS') return !command.actor.breakGlassSessionId;
    if (override.decision === 'REQUIRES_STEP_UP') return !command.actor.mfaAuthenticated;
    return false;
  }

  private aggregateTypeMatches(policyAggregateType: string, commandAggregateType: string): boolean {
    return this.normalizePolicyToken(policyAggregateType) === this.normalizePolicyToken(commandAggregateType);
  }

  private commandActionMatches(policyAction: string, command: HrCommandEnvelope<unknown>): boolean {
    const normalizedPolicyAction = this.normalizePolicyToken(policyAction);
    return this.commandActionCandidates(command).some((candidate) => (
      this.normalizePolicyToken(candidate) === normalizedPolicyAction
    ));
  }

  private commandActionCandidates(command: HrCommandEnvelope<unknown>): string[] {
    const normalizedCommandName = this.normalizePolicyToken(command.commandName);
    const normalizedAggregateType = this.normalizePolicyToken(command.aggregateType);
    const aggregateParts = normalizedAggregateType.split('_').filter(Boolean);
    const commandParts = normalizedCommandName.split('_').filter(Boolean);
    const verb = commandParts[0];
    const aggregateTail = aggregateParts[aggregateParts.length - 1];
    const candidates = new Set<string>([
      command.commandName,
      this.inferActionFromCommand(command.commandName),
      normalizedCommandName,
      this.inferCommandType(command.commandName),
    ]);

    if (verb && aggregateTail) {
      candidates.add(`${verb}_${aggregateTail}`);
    }
    if (verb) {
      candidates.add(verb);
    }

    return Array.from(candidates);
  }

  private fieldPathMatchesOverride(payloadPath: string, overrideFieldPath: string): boolean {
    const normalizedPayloadPath = this.normalizeFieldPath(payloadPath);
    const normalizedOverridePath = this.normalizeFieldPath(overrideFieldPath);
    return (
      normalizedPayloadPath === normalizedOverridePath
      || normalizedPayloadPath.endsWith(`.${normalizedOverridePath}`)
      || normalizedOverridePath.endsWith(`.${normalizedPayloadPath}`)
      || normalizedPayloadPath.startsWith(`${normalizedOverridePath}.`)
    );
  }

  private rolesMatch(policyRoles: string[] | undefined, actorRoles: string[]): boolean {
    if (!policyRoles || policyRoles.length === 0) return true;
    const actorRoleSet = new Set(actorRoles);
    return policyRoles.some((role) => actorRoleSet.has(role));
  }

  private policyScopeMatches(
    scope: HcmPolicyScope | undefined,
    command: HrCommandEnvelope<unknown>,
  ): boolean {
    if (!scope) return true;
    if (scope.tenantId && scope.tenantId !== command.tenantId.value) return false;

    const now = Date.now();
    if (scope.effectiveFrom && new Date(`${scope.effectiveFrom}T00:00:00.000Z`).getTime() > now) return false;
    if (scope.effectiveUntil && new Date(`${scope.effectiveUntil}T23:59:59.999Z`).getTime() < now) return false;

    const actorScope = command.actor as typeof command.actor & ActorScopeClaims;
    return this.claimsMatch(scope.countryCodes, actorScope.countryCodes)
      && this.claimsMatch(scope.legalEntityIds, actorScope.legalEntityIds)
      && this.claimsMatch(scope.branchCodes, actorScope.branchCodes)
      && this.claimsMatch(scope.orgUnitIds, actorScope.orgUnitIds)
      && this.claimsMatch(scope.departmentIds, actorScope.departmentIds)
      && this.claimsMatch(scope.jobCodes, actorScope.jobCodes)
      && this.claimsMatch(scope.gradeCodes, actorScope.gradeCodes)
      && this.claimsMatch(scope.locationCodes, actorScope.locationCodes)
      && this.claimsMatch(scope.employeeTypes, actorScope.employeeTypes)
      && this.claimsMatch(scope.managerWorkerIds, actorScope.managerWorkerIds)
      && this.workerScopeMatches(scope.workerIds, command);
  }

  private policyScopeSpecificity(scope: HcmPolicyScope | undefined): number {
    if (!scope) return 0;
    const hasValues = (values: string[] | undefined) => Boolean(values && values.length > 0);
    const specificityTieBreaker = [
      scope.countryCodes,
      scope.legalEntityIds,
      scope.branchCodes,
      scope.orgUnitIds,
      scope.departmentIds,
      scope.locationCodes,
      scope.employeeTypes,
      scope.jobCodes,
      scope.gradeCodes,
      scope.managerWorkerIds,
      scope.workerIds,
    ].filter(hasValues).length;

    if (hasValues(scope.workerIds)) return 1000 + specificityTieBreaker;
    if (hasValues(scope.managerWorkerIds)) return 900 + specificityTieBreaker;
    if (hasValues(scope.jobCodes) || hasValues(scope.gradeCodes)) return 800 + specificityTieBreaker;
    if (
      hasValues(scope.departmentIds)
      || hasValues(scope.orgUnitIds)
      || hasValues(scope.locationCodes)
      || hasValues(scope.branchCodes)
      || hasValues(scope.employeeTypes)
    ) return 700 + specificityTieBreaker;
    if (hasValues(scope.legalEntityIds)) return 600 + specificityTieBreaker;
    if (hasValues(scope.countryCodes)) return 500 + specificityTieBreaker;
    return 100;
  }

  private claimsMatch(policyValues: string[] | undefined, actorValues: string[] | undefined): boolean {
    if (!policyValues || policyValues.length === 0) return true;
    const actorSet = new Set(actorValues ?? []);
    return policyValues.some((value) => actorSet.has(value));
  }

  private workerScopeMatches(
    policyWorkerIds: string[] | undefined,
    command: HrCommandEnvelope<unknown>,
  ): boolean {
    if (!policyWorkerIds || policyWorkerIds.length === 0) return true;
    const subjectWorkerId = this.resolveSubjectWorkerId(command);
    const payloadWorkerId = this.extractPayloadUuid(command.payload, 'workerId')
      ?? this.extractPayloadUuid(command.payload, 'employeeId');
    return policyWorkerIds.some((workerId) => (
      workerId === command.actor.actorId.value
      || workerId === subjectWorkerId?.value
      || workerId === command.aggregateId?.value
      || workerId === payloadWorkerId?.value
    ));
  }

  private normalizePolicyToken(value: string): string {
    return value
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s.-]+/g, '_')
      .toUpperCase();
  }

  private normalizeFieldPath(value: string): string {
    return value
      .trim()
      .replace(/\.\d+(?=\.|$)/g, '')
      .toLowerCase();
  }

  private async resolveActorEmploymentStatus(
    command: HrCommandEnvelope<unknown>,
    actorType: 'SYSTEM' | 'INTEGRATION' | 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'HRBP' | 'EXECUTIVE' | 'EXTERNAL',
  ): Promise<string | undefined> {
    if (actorType !== 'EMPLOYEE' && actorType !== 'MANAGER') return undefined;
    const byId = await this.db
      .selectFrom('workers')
      .select(['status'])
      .where('id', '=', command.actor.actorId.value)
      .where('tenant_id', '=', command.tenantId.value)
      .executeTakeFirst();
    if (byId?.status) return byId.status;

    const actorEmail = (command.actor as { email?: string }).email;
    if (!actorEmail) return undefined;
    const byEmail = await this.db
      .selectFrom('workers')
      .select(['status'])
      .where('email', '=', actorEmail)
      .where('tenant_id', '=', command.tenantId.value)
      .executeTakeFirst();
    return byEmail?.status ?? undefined;
  }

  private mapActorType(
    actorType: 'USER' | 'SYSTEM' | 'SERVICE_ACCOUNT' | 'INTEGRATION',
    roles: string[],
  ): 'SYSTEM' | 'INTEGRATION' | 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'HRBP' | 'EXECUTIVE' | 'EXTERNAL' {
    switch (actorType) {
      case 'SYSTEM':
      case 'SERVICE_ACCOUNT':
        return 'SYSTEM';
      case 'INTEGRATION':
        return 'EXTERNAL';
      case 'USER':
      default:
        if (roles.includes('HR_ADMIN')) return 'HR_ADMIN';
        if (roles.includes('WORKFORCE_PLANNING_ADMIN')) return 'HR_ADMIN';
        if (roles.includes('MANAGER')) return 'MANAGER';
        if (roles.includes('HRBP')) return 'HRBP';
        if (roles.includes('EXECUTIVE')) return 'EXECUTIVE';
        return 'EMPLOYEE';
    }
  }

  private readUuidValue(value: unknown): string | undefined {
    if (value instanceof Uuid) return value.value;
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const raw = (value as { value?: unknown }).value;
      return typeof raw === 'string' ? raw : undefined;
    }
    return typeof value === 'string' ? value : undefined;
  }

  private resolveSubjectWorkerId(
    command: HrCommandEnvelope<unknown>,
    result?: CommandResult<unknown>,
  ): Uuid | undefined {
    return (
      command.subjectWorkerId ??
      this.extractPayloadUuid(command.payload, 'subjectWorkerId') ??
      this.extractPayloadUuid(command.payload, 'workerId') ??
      this.extractPayloadUuid(command.payload, 'employeeId') ??
      this.extractPayloadUuid(result?.data, 'subjectWorkerId') ??
      this.extractPayloadUuid(result?.data, 'workerId') ??
      this.extractPayloadUuid(result?.data, 'employeeId')
    );
  }

  private inferEmployeeDataCategory(aggregateType: string): HrEventPrivacy['employeeDataCategory'] {
    const normalized = aggregateType.toLowerCase();
    if (normalized.includes('payroll') || normalized.includes('payslip')) return 'PAYROLL';
    if (normalized.includes('compensation') || normalized.includes('bonus') || normalized.includes('equity')) return 'COMPENSATION';
    if (normalized.includes('benefits')) return 'BENEFITS';
    if (normalized.includes('performance') || normalized.includes('objective') || normalized.includes('goal')) return 'PERFORMANCE';
    if (normalized.includes('relations') || normalized.includes('disciplinary') || normalized.includes('grievance')) return 'ER_CASE';
    if (normalized.includes('medical') || normalized.includes('wellness') || normalized.includes('eap')) return 'MEDICAL';
    if (normalized.includes('authorization') || normalized.includes('visa') || normalized.includes('immigration')) return 'IMMIGRATION';
    if (normalized.includes('survey')) return 'SURVEY';
    return 'PROFILE';
  }

  private async selectAggregateState(
    tx: Transaction<Database>,
    loader: AggregateLoaderConfig,
    command: HrCommandEnvelope<unknown>,
  ): Promise<AggregateStateRow | undefined> {
    const dynamicTx = tx as unknown as {
      selectFrom: (table: string) => {
        select: (columns: string[]) => {
          where: (column: string, operator: string, value: string) => {
            where: (column: string, operator: string, value: string) => {
              executeTakeFirst: () => Promise<AggregateStateRow | undefined>;
            };
          };
        };
      };
    };
    try {
      return await dynamicTx
        .selectFrom(loader.table)
        .select(['id', loader.versionColumn, loader.stateColumn])
        .where('tenant_id', '=', command.tenantId.value)
        .where('id', '=', command.aggregateId!.value)
        .executeTakeFirst();
    } catch (err) {
      if (this.isMissingAggregateTableError(err)) {
        return undefined;
      }
      throw err;
    }
  }

  private resolveAggregateLoader(aggregateType: string): AggregateLoaderConfig {
    return AGGREGATE_LOADERS[aggregateType] ?? aggregateLoader(this.pluralizeSnakeCase(aggregateType));
  }

  private pluralizeSnakeCase(value: string): string {
    const snake = value
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
    if (snake.endsWith('y')) return `${snake.slice(0, -1)}ies`;
    if (snake.endsWith('s')) return snake;
    return `${snake}s`;
  }

  private isMissingAggregateTableError(error: unknown): boolean {
    // ONLY a genuinely missing relation (42P01 undefined_table) is tolerated — that is
    // a legitimate "aggregate has no table yet" case. A missing COLUMN (42703) or any
    // other error is a real misconfiguration that must surface, not be swallowed: the
    // failed SELECT has already aborted the command transaction, so swallowing it would
    // silently poison the rest of the pipeline (PROD-2). Match by error code, not the
    // broad "does not exist" message (which also matches undefined_column).
    const maybeDbError = error as { code?: unknown; message?: unknown };
    if (maybeDbError.code === '42P01') return true;
    if (maybeDbError.code !== undefined) return false;
    return (
      typeof maybeDbError.message === 'string' &&
      maybeDbError.message.includes('does not exist') &&
      !maybeDbError.message.includes('column')
    );
  }

  private flattenPayloadPaths(value: unknown, prefix = ''): string[] {
    if (value === null || value === undefined || value instanceof Date || value instanceof Uuid) {
      return prefix ? [prefix] : [];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => this.flattenPayloadPaths(item, prefix ? `${prefix}.${index}` : String(index)));
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return prefix ? [prefix] : [];
      return entries.flatMap(([key, child]) => this.flattenPayloadPaths(child, prefix ? `${prefix}.${key}` : key));
    }
    return prefix ? [prefix] : [];
  }

  private extractPayloadUuid(payload: unknown, key: string): Uuid | undefined {
    if (payload === null || payload === undefined) return undefined;
    if (payload instanceof Uuid) return undefined;
    if (Array.isArray(payload)) {
      for (const item of payload) {
        const found = this.extractPayloadUuid(item, key);
        if (found) return found;
      }
      return undefined;
    }
    if (typeof payload !== 'object') return undefined;
    const record = payload as Record<string, unknown>;
    const raw = record[key];
    const rawValue = this.readUuidValue(raw);
    if (rawValue && Uuid.isValid(rawValue)) return new Uuid(rawValue);
    for (const child of Object.values(record)) {
      const found = this.extractPayloadUuid(child, key);
      if (found) return found;
    }
    return undefined;
  }

  private async isDirectManager(subjectWorkerId: Uuid, managerId: string, tenantId: Uuid): Promise<boolean> {
    const report = await this.db
      .selectFrom('workers')
      .select(['id'])
      .where('id', '=', subjectWorkerId.value)
      .where('tenant_id', '=', tenantId.value)
      .where('manager_id', '=', managerId)
      .executeTakeFirst();
    return Boolean(report);
  }

  private async stepEvaluateManagerRelationship(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (!command.actor.roles.includes('MANAGER')) return;
    if (command.actor.roles.some((role) => ['HR_ADMIN', 'HRBP', 'PAYROLL_ADMIN', 'SUPER_ADMIN'].includes(role))) return;
    const subjectWorkerId = command.subjectWorkerId ?? this.extractPayloadUuid(command.payload, 'workerId');
    if (!subjectWorkerId) return;

    const actorId = this.readUuidValue(command.actor.actorId);
    if (actorId && await this.isDirectManager(subjectWorkerId, actorId, command.tenantId)) {
      return;
    }
    const actorEmail = (command.actor as { email?: string }).email;
    if (actorEmail) {
      const manager = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('email', '=', actorEmail)
        .where('tenant_id', '=', command.tenantId.value)
        .executeTakeFirst();
      if (manager && await this.isDirectManager(subjectWorkerId, manager.id, command.tenantId)) {
        return;
      }
    }

    throw this.makeError(
      command,
      CommandPipelineStep.EVALUATE_MANAGER_HRBP_RELATIONSHIP,
      'MANAGER_RELATIONSHIP_DENIED',
      'Manager commands can only target direct reports',
      false,
    );
  }

  private async stepEvaluatePolicyEngine(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (command.actor.actorType === 'SYSTEM' || command.actor.actorType === 'SERVICE_ACCOUNT') {
      return;
    }
    if (command.aggregateType === 'ApprovalChain') {
      return;
    }

    const subjectWorkerId = this.resolveSubjectWorkerId(command);
    const decision = await selfServiceAuthorityEngine.execute({
      actorType: this.mapActorType(command.actor.actorType, command.actor.roles),
      commandName: command.commandName,
      actorRoles: command.actor.roles,
      abacContext: {
        aggregateType: command.aggregateType,
        aggregateId: command.aggregateId?.value,
        commandType: this.inferCommandType(command.commandName),
        subjectWorkerId: subjectWorkerId?.value,
        expectedState: command.expectedState,
        clientType: command.metadata.clientType,
      },
    }, {
      tenantId: command.tenantId,
      actorId: command.actor.actorId,
      correlationId: command.correlationId,
      effectiveDate: new Date(),
      workerId: subjectWorkerId,
    });

    if (decision.decisionCode === 'FORBIDDEN') {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE,
        'POLICY_ENGINE_DENIED',
        decision.explanation,
        false,
      );
    }
  }

  private async stepEvaluateFsm(
    command: HrCommandEnvelope<unknown>,
    aggregate?: AggregateRoot,
  ): Promise<void> {
    if (!command.expectedState) {
      return;
    }
    if (!aggregate) {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_WORKFLOW_GUARD_EXPECTED_STATE_VERSION_EFFECTIVE_DATE,
        'AGGREGATE_NOT_LOADED',
        `Could not load ${command.aggregateType} ${command.aggregateId?.value ?? '<missing>'} for FSM validation`,
        false,
      );
    }
    const aggregateVersion = typeof aggregate.version === 'string'
      ? Number(aggregate.version)
      : aggregate.version;
    const expectedVersion = typeof command.expectedVersion === 'string'
      ? Number(command.expectedVersion)
      : command.expectedVersion;
    if (
      expectedVersion !== undefined &&
      (!Number.isFinite(aggregateVersion) || !Number.isFinite(expectedVersion) || aggregateVersion !== expectedVersion)
    ) {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_WORKFLOW_GUARD_EXPECTED_STATE_VERSION_EFFECTIVE_DATE,
        'AGGREGATE_VERSION_CONFLICT',
        `Expected aggregate version ${command.expectedVersion}, found ${aggregate.version}`,
        false,
      );
    }
    const fsmInstance: FsmInstance<string> = {
      aggregateId: command.aggregateId!,
      aggregateType: command.aggregateType,
      currentState: command.expectedState,
      version: aggregateVersion,
      history: [],
    };
    const allowed = this.fsmFramework.getAllowedActions(fsmInstance);
    const actionCandidates = this.inferFsmActionCandidates(command.commandName, command.aggregateType);
    if (!actionCandidates.some((action) => allowed.includes(action))) {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_WORKFLOW_GUARD_EXPECTED_STATE_VERSION_EFFECTIVE_DATE,
        'FSM_TRANSITION_NOT_ALLOWED',
        `Action ${actionCandidates[0]} not allowed from state ${fsmInstance.currentState}`,
        false,
      );
    }
  }

  private async stepEvaluateLegalAndPolicy(command: HrCommandEnvelope<unknown>): Promise<void> {
    const subjectWorkerId = command.subjectWorkerId ?? this.extractPayloadUuid(command.payload, 'workerId');
    if (!subjectWorkerId) return;
    if (command.actor.roles.some((role) => ['LEGAL', 'COMPLIANCE_OFFICER', 'SUPER_ADMIN'].includes(role))) return;
    if (command.actor.breakGlassSessionId) return;

    const worker = await this.db
      .selectFrom('workers')
      .select(['id', 'legal_hold_status'])
      .where('tenant_id', '=', command.tenantId.value)
      .where('id', '=', subjectWorkerId.value)
      .executeTakeFirst();
    if (worker?.legal_hold_status === 'ACTIVE') {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE,
        'LEGAL_HOLD_BLOCKED',
        'Worker is under active legal hold; mutation requires Legal, Compliance, or break-glass authority',
        false,
      );
    }
  }

  private async stepEvaluateSoD(command: HrCommandEnvelope<unknown>): Promise<void> {
    const action = this.inferActionFromCommand(command.commandName);
    const result = this.accessControl.checkSoD(action, command.actor.roles);
    if (result.violated) {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_SOD_POLICY,
        'SOD_VIOLATION',
        result.message ?? 'Segregation of duties violation',
        false,
      );
    }
  }

  private async stepWriteState(
    _tx: Transaction<Database>,
    _command: HrCommandEnvelope<unknown>,
    _result: CommandResult<unknown>,
  ): Promise<void> {
    return;
  }

  private async stepWriteTransitionLedger(
    _tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
  ): Promise<void> {
    await this.transitionLedger.recordTransition({
      id: Uuid.generate(),
      tenantId: command.tenantId,
      aggregateType: command.aggregateType,
      aggregateId: result.aggregateId,
      fromState: command.expectedState ?? 'INITIAL',
      toState: result.newState,
      action: this.inferActionFromCommand(command.commandName),
      triggeredBy: command.actor.actorId.value,
      occurredAt: new Date(),
      correlationId: command.correlationId,
      commandId: command.commandId,
    });
  }

  private async stepWriteAuditRecord(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
    policyDecisionEvidence?: CommandPolicyDecisionEvidence,
  ): Promise<Uuid> {
    const auditId = Uuid.generate();
    await tx
      .insertInto('audit_log')
      .values({
        id: auditId.value,
        tenant_id: command.tenantId.value,
        actor_type: command.actor.actorType,
        actor_id: command.actor.actorId.value,
        action: command.commandName,
        resource_type: command.aggregateType,
        resource_id: result.aggregateId.value,
        payload: {
          commandId: command.commandId.value,
          newState: result.newState,
          newVersion: result.newVersion,
          correlationId: command.correlationId.value,
          policyDecisionEvidence: policyDecisionEvidence ? [policyDecisionEvidence] : [],
        } as unknown as Record<string, never>,
        occurred_at: new Date(),
        correlation_id: command.correlationId.value,
      })
      .execute();
    return auditId;
  }

  private async stepWriteOutbox(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
    policyDecisionEvidence?: CommandPolicyDecisionEvidence,
  ): Promise<void> {
    const eventNames = result.eventsEmitted?.length
      ? result.eventsEmitted
      : [this.inferEventNameFromCommand(command.commandName, command.aggregateType)];

    for (const eventName of eventNames) {
      const subjectWorkerId = this.resolveSubjectWorkerId(command, result);
      const privacy = createPrivacyForEvent(
        command.metadata.hrDataSensitivity ?? 'NONE',
        subjectWorkerId?.value,
        this.inferEmployeeDataCategory(command.aggregateType),
      );
      const event: HrEventEnvelope<unknown> = {
        eventId: crypto.randomUUID() as unknown as Uuid,
        eventName,
        eventSchemaVersion: 1,
        tenantId: command.tenantId,
        aggregateType: command.aggregateType,
        aggregateId: result.aggregateId,
        payload: result.data,
        metadata: {
          correlationId: command.correlationId,
          causationId: command.commandId,
          sourceEventId: command.sourceEventId,
          processInstanceId: command.processInstanceId,
          requestHash: command.metadata.requestHash,
          clientType: command.metadata.clientType,
          dataResidencyRegion: command.metadata.dataResidencyRegion,
          hrDataSensitivity: command.metadata.hrDataSensitivity,
        },
        privacy,
        occurredAt: new Date(),
        version: result.newVersion,
      };
      const metadata = {
        ...outboxMetadataForEvent(event),
        ...(policyDecisionEvidence ? { policyDecisionEvidence: [policyDecisionEvidence] } : {}),
      };

      await tx
        .insertInto('outbox_events')
        .values({
          id: crypto.randomUUID(),
          tenant_id: command.tenantId.value,
          event_name: event.eventName,
          aggregate_type: event.aggregateType,
          aggregate_id: event.aggregateId.value,
          payload: event.payload as unknown as Record<string, never>,
          metadata: metadata as unknown as Record<string, never>,
          event_schema_version: event.eventSchemaVersion,
          event_topic: metadata.topic,
          envelope_version: event.version,
          correlation_id: event.metadata.correlationId.value,
          causation_id: event.metadata.causationId?.value ?? null,
          created_at: new Date().toISOString(),
          published_at: null,
          publish_attempt_count: 0,
        })
        .execute();
    }
  }

  private async stepWritePolicyDecisionEvidence(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
    evidence?: CommandPolicyDecisionEvidence,
  ): Promise<void> {
    if (!evidence?.policyRevisionId || !this.isUuid(evidence.policyRevisionId)) return;

    const dynamicTx = tx as unknown as {
      insertInto: (table: string) => {
        values: (row: Record<string, unknown>) => {
          execute: () => Promise<unknown>;
        };
      };
    };
    await dynamicTx
      .insertInto('hr_platform.admin_policy_decision_evidence')
      .values({
        id: Uuid.generate().value,
        tenant_id: command.tenantId.value,
        policy_revision_id: evidence.policyRevisionId,
        service_area: evidence.serviceArea,
        engine_name: evidence.engineName,
        engine_version: evidence.engineVersion,
        scope_match: evidence.scopeMatch,
        decision: evidence.decision,
        reason: evidence.reason,
        subject_worker_id: evidence.subjectWorkerId ?? null,
        source_record_id: evidence.sourceRecordId ?? result.aggregateId.value,
        created_at: new Date(),
      })
      .execute();
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private async stepStoreIdempotencyResult(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
  ): Promise<void> {
    await tx
      .updateTable('idempotency_keys')
      .set({ status: 'SUCCESS' })
      .where('tenant_id', '=', command.tenantId.value)
      .where('key', '=', command.idempotencyKey)
      .execute();

    const cacheKey = `idempotency:${command.tenantId.value}:${command.idempotencyKey}`;
    await this.redisCache.set(cacheKey, result, 86400);
  }

  private async stepStoreIdempotencyError(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    error: CommandError,
  ): Promise<void> {
    await tx
      .updateTable('idempotency_keys')
      .set({ status: 'FAILED' })
      .where('tenant_id', '=', command.tenantId.value)
      .where('key', '=', command.idempotencyKey)
      .execute();

    const cacheKey = `idempotency:${command.tenantId.value}:${command.idempotencyKey}`;
    await this.redisCache.set(cacheKey, error, 86400);
  }

  private inferCommandType(commandName: string): string {
    const normalizedName = commandName
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s.-]+/g, '_')
      .toUpperCase();
    if (normalizedName.includes('CREATE') || normalizedName.includes('ADD')) return 'CREATE';
    if (normalizedName.includes('UPDATE') || normalizedName.includes('EDIT')) return 'UPDATE';
    if (normalizedName.includes('DELETE') || normalizedName.includes('REMOVE')) return 'DELETE';
    if (normalizedName.includes('APPROVE')) return 'APPROVE';
    return 'READ';
  }

  private inferActionFromCommand(commandName: string): string {
    return commandName.split('.').pop() ?? commandName;
  }

  private inferFsmActionCandidates(commandName: string, aggregateType: string): string[] {
    const action = this.inferActionFromCommand(commandName);
    const candidates = [action];
    const normalizedAggregate = aggregateType.charAt(0).toUpperCase() + aggregateType.slice(1);
    if (action.endsWith(normalizedAggregate) && action.length > normalizedAggregate.length) {
      candidates.push(action.slice(0, -normalizedAggregate.length));
    }
    return [...new Set(candidates)];
  }

  private inferEventNameFromCommand(commandName: string, aggregateType: string): string {
    return `${aggregateType}${this.inferPastTenseFromCommand(commandName)}`;
  }

  private inferPastTenseFromCommand(commandName: string): string {
    const tail = commandName.split('.').pop() ?? commandName;
    const verbs: Array<[RegExp, string]> = [
      [/^Create/i, 'Created'],
      [/^Add/i, 'Added'],
      [/^Activate/i, 'Activated'],
      [/^Apply/i, 'Applied'],
      [/^Approve/i, 'Approved'],
      [/^Archive/i, 'Archived'],
      [/^Calculate/i, 'Calculated'],
      [/^Cancel/i, 'Canceled'],
      [/^Close/i, 'Closed'],
      [/^Complete/i, 'Completed'],
      [/^Delete/i, 'Deleted'],
      [/^Deprecate/i, 'Deprecated'],
      [/^Explain/i, 'Explained'],
      [/^Fail/i, 'Failed'],
      [/^Finalize/i, 'Finalized'],
      [/^Launch/i, 'Launched'],
      [/^Lock/i, 'Locked'],
      [/^Open/i, 'Opened'],
      [/^Publish/i, 'Published'],
      [/^Queue/i, 'Queued'],
      [/^Record/i, 'Recorded'],
      [/^Reject/i, 'Rejected'],
      [/^Review/i, 'Reviewed'],
      [/^Start/i, 'Started'],
      [/^Submit/i, 'Submitted'],
      [/^Update/i, 'Updated'],
      [/^Validate/i, 'Validated'],
    ];
    return verbs.find(([pattern]) => pattern.test(tail))?.[1] ?? 'CommandSucceeded';
  }
}
