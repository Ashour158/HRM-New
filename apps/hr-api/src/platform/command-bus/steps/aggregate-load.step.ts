import type { Transaction } from 'kysely';
import { Uuid, type AggregateRoot } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { makeError } from '../command-bus-errors.js';
import { isMissingAggregateTableError, pluralizeSnakeCase } from '../command-bus.utils.js';
import { LoadedAggregate, type AggregateLoaderConfig, type AggregateStateRow } from './types.js';

export function aggregateLoader(table: string, stateColumn: 'status' | 'state' = 'status'): AggregateLoaderConfig {
  return { table, stateColumn, versionColumn: 'aggregate_version' };
}

export const AGGREGATE_LOADERS: Record<string, AggregateLoaderConfig> = {
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
  I9Case: aggregateLoader('hr_i9_everify.i9_forms'),
  EverifyCase: aggregateLoader('hr_i9_everify.everify_cases'),
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

/** Loads (and expected-state-checks) the aggregate a command targets, under row lock via `tx`. */
export class AggregateLoadStep {
  async load(
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
      throw makeError(
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
      if (isMissingAggregateTableError(err)) {
        return undefined;
      }
      throw err;
    }
  }

  private resolveAggregateLoader(aggregateType: string): AggregateLoaderConfig {
    return AGGREGATE_LOADERS[aggregateType] ?? aggregateLoader(pluralizeSnakeCase(aggregateType));
  }
}
