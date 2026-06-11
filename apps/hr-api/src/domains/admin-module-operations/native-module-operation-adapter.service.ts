import { Injectable, Logger } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { sql, type Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { computeRequestHash } from '@hcm/platform-core';
import { CommandBus } from '../../platform/command-bus/command-bus.js';
import { AdminModuleOperationsRepository, type OperationRecordStatus, type OperationRisk } from './admin-module-operations.repository.js';

type NativeSourceConfig = {
  sourceKey: string;
  tableExpression: string;
  objectType: string;
  ownerRole: string;
  workflowName: string;
  labelExpression: string;
  statusExpression?: string;
  nativeRoute?: string;
};

type NativeOperationRow = {
  id: string;
  native_label: string | null;
  native_status: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type NativeStatusCommand = {
  commandName: string;
  aggregateType: string;
  aggregateId: Uuid;
  payload: Record<string, unknown>;
};

export type NativeOperationAction = 'advance' | 'approve' | 'process' | 'make-effective' | 'terminate' | 'reject';

const DEFAULT_LIMIT_PER_SOURCE = 10;

function schemaTable(schema: string, name: string): string {
  return `"${schema}"."${name}"`;
}

function route(base: string): string {
  return base;
}

function config(sourceKey: string, tableExpression: string, objectType: string, ownerRole: string, workflowName: string, labelExpression: string, options: Partial<NativeSourceConfig> = {}): NativeSourceConfig {
  return {
    sourceKey,
    tableExpression,
    objectType,
    ownerRole,
    workflowName,
    labelExpression,
    statusExpression: options.statusExpression ?? 'status',
    nativeRoute: options.nativeRoute,
  };
}

const NATIVE_SOURCE_REGISTRY: Record<string, NativeSourceConfig[]> = {
  employees: [
    config('workers', schemaTable('hr_core', 'workers'), 'Employee profile', 'HR Admin', 'Employee profile maintenance', "employee_number || ' - ' || first_name || ' ' || last_name", { nativeRoute: route('/admin/employees') }),
    config('employment_relationships', schemaTable('hr_core', 'employment_relationships'), 'Employment relationship', 'HR Admin', 'Hire to active employee', "'Relationship ' || relationship_type || ' - ' || worker_id::text", { statusExpression: 'state', nativeRoute: route('/admin/employees') }),
    config('job_assignments', schemaTable('hr_core', 'job_assignments'), 'Job assignment', 'HR Admin', 'Job assignment to payroll eligibility', "coalesce(job_title, 'Job assignment') || ' - ' || worker_id::text", { statusExpression: 'state', nativeRoute: route('/admin/employees') }),
    config('employment_contracts', schemaTable('hr_core', 'employment_contracts'), 'Employment contract', 'HR Admin', 'Contract governance', "contract_type || ' contract - ' || worker_id::text", { statusExpression: 'state', nativeRoute: route('/admin/employees') }),
  ],
  organization: [
    config('legal_entities', schemaTable('hr_org', 'legal_entities'), 'Legal entity', 'HR Admin', 'Build org chart', "code || ' - ' || name", { nativeRoute: route('/admin/organization') }),
    config('org_units', schemaTable('hr_org', 'org_units'), 'Org unit', 'HR Admin', 'Build org chart', "coalesce(code, id::text) || ' - ' || name", { nativeRoute: route('/admin/organization') }),
    config('manager_relationships', schemaTable('hr_org', 'manager_relationships'), 'Manager relationship', 'HR Admin', 'Resolve manager approvals', "'Manager link ' || worker_id::text || ' -> ' || manager_id::text", { statusExpression: "case when end_date is null then 'ACTIVE' else 'CLOSED' end", nativeRoute: route('/admin/organization') }),
  ],
  'position-control': [
    config('positions', schemaTable('hr_position', 'positions'), 'Position', 'HR Admin', 'Approve position', "position_code || ' - ' || title", { nativeRoute: route('/admin/workforce-planning') }),
    config('headcount_requests', schemaTable('hr_position', 'headcount_requests'), 'Headcount request', 'Finance', 'Request headcount', "request_number || ' - ' || left(justification, 60)", { nativeRoute: route('/admin/workforce-planning') }),
  ],
  attendance: [
    config('time_clock_events', schemaTable('hr_time', 'time_clock_events'), 'Clock event', 'HR Admin', 'Employee check-in to daily ledger', "event_type || ' - ' || worker_id::text", { nativeRoute: route('/admin/attendance') }),
    config('attendance_daily_ledgers', schemaTable('hr_time', 'attendance_daily_ledgers'), 'Daily ledger', 'Payroll Admin', 'Period close to payroll input', "employee_id || ' - ' || worker_name || ' - ' || work_date::text", { nativeRoute: route('/admin/attendance') }),
    config('attendance_correction_requests', schemaTable('hr_time', 'attendance_correction_requests'), 'Correction request', 'Manager', 'Manager correction approval', "correction_type || ' - ' || worker_id::text || ' - ' || work_date::text", { nativeRoute: route('/admin/attendance') }),
    config('attendance_exceptions', schemaTable('hr_time', 'attendance_exceptions'), 'Attendance exception', 'HR Admin', 'Resolve attendance exception', "exception_type || ' - ' || worker_id::text", { nativeRoute: route('/admin/attendance') }),
  ],
  leave: [
    config('absence_requests', schemaTable('hr_absence', 'absence_requests'), 'Leave request', 'Manager', 'Employee leave request', "absence_type || ' - ' || worker_id::text || ' - ' || start_date::text", { nativeRoute: route('/admin/leave') }),
    config('leave_cases', schemaTable('hr_absence', 'leave_cases'), 'Leave case', 'HR Admin', 'Manage leave case', "leave_type || ' - ' || worker_id::text || ' - ' || start_date::text", { nativeRoute: route('/admin/leave') }),
    config('absence_accrual_balances', schemaTable('hr_absence', 'absence_accrual_balances'), 'Accrual balance', 'Payroll Admin', 'Policy-driven duration and balance impact', "leave_type || ' balance - ' || worker_id::text", { nativeRoute: route('/admin/leave') }),
    config('leave_entitlement_calculations', schemaTable('hr_absence', 'leave_entitlement_calculations'), 'Entitlement calculation', 'HR Admin', 'Policy-driven duration and balance impact', "leave_type || ' entitlement - ' || worker_id::text", { nativeRoute: route('/admin/leave') }),
  ],
  'workforce-management': [
    config('shift_schedules', schemaTable('hr_wfm', 'shift_schedules'), 'Shift schedule', 'Scheduler', 'Publish schedule', "shift_date::text || ' - ' || worker_id::text"),
    config('open_shifts', schemaTable('hr_wfm', 'open_shifts'), 'Open shift', 'Scheduler', 'Open shift bid', "shift_date::text || ' - open shift - ' || department_id::text"),
    config('shift_bids', schemaTable('hr_wfm', 'shift_bids'), 'Shift bid', 'Manager', 'Bid for shift', "bid_date::text || ' - ' || worker_id::text"),
    config('shift_swap_requests', schemaTable('hr_wfm', 'shift_swap_requests'), 'Swap request', 'Manager', 'Approve swap request', "requester_worker_id::text || ' -> ' || target_worker_id::text"),
    config('coverage_gaps', schemaTable('hr_wfm', 'coverage_gaps'), 'Coverage gap', 'Manager', 'Resolve coverage gap', "shift_date::text || ' - gap - ' || department_id::text"),
    config('wfm_overtime_approvals', schemaTable('hr_wfm', 'wfm_overtime_approvals'), 'Overtime approval', 'Payroll Admin', 'Queue payroll handoff', "requested_hours::text || 'h - ' || worker_id::text"),
  ],
  payroll: [
    config('payroll_cycles', schemaTable('hr_payroll', 'payroll_cycles'), 'Payroll cycle', 'Payroll Admin', 'Payroll calculation to review', 'cycle_name', { nativeRoute: route('/admin/payroll') }),
    config('payroll_inputs', schemaTable('hr_payroll', 'payroll_inputs'), 'Payroll input', 'Payroll Admin', 'Attendance close to payroll input', "input_type || ' - ' || worker_id::text", { nativeRoute: route('/admin/payroll') }),
    config('payroll_calculation_runs', schemaTable('hr_payroll', 'payroll_calculation_runs'), 'Calculation run', 'Payroll Admin', 'Payroll calculation to review', "'Calculation run - ' || payroll_cycle_id::text", { nativeRoute: route('/admin/payroll') }),
    config('payroll_payment_batches', schemaTable('hr_payroll', 'payroll_payment_batches'), 'Payment batch', 'Finance', 'Bank file export', 'batch_number', { nativeRoute: route('/admin/payroll') }),
    config('payroll_export_jobs', schemaTable('hr_payroll', 'payroll_export_jobs'), 'Payroll export', 'Payroll Admin', 'Bank file export', "export_type || ' - ' || file_name", { nativeRoute: route('/admin/payroll') }),
    config('payroll_gl_postings', schemaTable('hr_payroll', 'payroll_gl_postings'), 'GL posting', 'Finance', 'GL posting', 'posting_number', { nativeRoute: route('/admin/payroll') }),
  ],
  compensation: [
    config('compensation_plans', schemaTable('hr_compensation', 'compensation_plans'), 'Comp plan', 'Compensation Admin', 'Propose pay change', 'name'),
    config('compensation_bands', schemaTable('hr_compensation', 'compensation_bands'), 'Comp band', 'Compensation Admin', 'Check band exception', "band_code || ' - ' || job_level || ' - ' || job_family"),
    config('compensation_changes', schemaTable('hr_compensation', 'compensation_changes'), 'Comp change', 'Manager', 'Approve comp change', "change_type || ' - ' || worker_id::text || ' - ' || new_amount::text || ' ' || currency"),
    config('bonus_cycles', schemaTable('hr_compensation', 'bonus_cycles'), 'Bonus cycle', 'Compensation Admin', 'Approve comp change', "cycle_name || ' - ' || cycle_year::text"),
    config('equity_grants', schemaTable('hr_compensation', 'equity_grants'), 'Equity grant', 'Compensation Admin', 'Generate total compensation statement', "grant_type || ' - ' || worker_id::text"),
    config('total_compensation_statements', schemaTable('hr_compensation', 'total_compensation_statements'), 'Total compensation statement', 'Employee', 'Generate total compensation statement', "statement_year::text || ' statement - ' || worker_id::text"),
  ],
  benefits: [
    config('benefits_programs', schemaTable('hr_benefits', 'benefits_programs'), 'Benefits program', 'Benefits Admin', 'Enroll in benefits', 'program_name'),
    config('benefits_enrollments', schemaTable('hr_benefits', 'benefits_enrollments'), 'Enrollment', 'Benefits Admin', 'Enroll in benefits', "coverage_level || ' - ' || worker_id::text"),
    config('benefits_life_events', schemaTable('hr_benefits', 'benefits_life_events'), 'Life event', 'Benefits Admin', 'Process life event', "event_type || ' - ' || worker_id::text"),
    config('spending_accounts', schemaTable('hr_benefits', 'spending_accounts'), 'Spending account', 'Payroll Admin', 'Send deductions to payroll', "account_type || ' - ' || worker_id::text"),
    config('carrier_reconciliation_runs', schemaTable('hr_benefits', 'carrier_reconciliation_runs'), 'Carrier reconciliation', 'Benefits Admin', 'Reconcile carrier file', "carrier_id::text || ' - ' || period_start::text || ' to ' || period_end::text"),
  ],
  recruiting: [
    config('job_requisitions', schemaTable('hr_recruiting', 'job_requisitions'), 'Job requisition', 'Recruiter', 'Create requisition', "requisition_number || ' - ' || title"),
    config('candidates', schemaTable('hr_recruiting', 'candidates'), 'Candidate', 'Recruiter', 'Screen candidate', "first_name || ' ' || last_name || ' - ' || email"),
    config('interview_plans', schemaTable('hr_recruiting', 'interview_plans'), 'Interview', 'Hiring Manager', 'Schedule interview', "'Interview - ' || candidate_id::text"),
    config('offers', schemaTable('hr_recruiting', 'offers'), 'Offer', 'HR Admin', 'Approve and accept offer', "currency || ' ' || proposed_salary::text || ' - ' || candidate_id::text"),
  ],
  onboarding: [
    config('onboarding_plans', schemaTable('hr_onboarding', 'onboarding_plans'), 'Onboarding plan', 'HR Admin', 'Launch onboarding plan', "'Plan - ' || worker_id::text || ' - ' || start_date::text", { nativeRoute: route('/admin/onboarding') }),
    config('onboarding_tasks', schemaTable('hr_onboarding', 'onboarding_tasks'), 'Onboarding task', 'Manager', 'Assign owner tasks', 'title', { nativeRoute: route('/admin/onboarding') }),
    config('onboarding_track_templates', schemaTable('hr_onboarding', 'onboarding_track_templates'), 'Onboarding track', 'HR Admin', 'Role-based onboarding plan', "code || ' - ' || name", { statusExpression: "case when active then 'ACTIVE' else 'SUSPENDED' end", nativeRoute: route('/admin/onboarding') }),
  ],
  performance: [
    config('performance_review_cycles', schemaTable('hr_performance', 'performance_review_cycles'), 'Review cycle', 'HR Admin', 'Create cycle', "coalesce(cycle_name::text, id::text)", { nativeRoute: route('/admin/performance') }),
    config('review_templates', schemaTable('hr_performance', 'review_templates'), 'Review template', 'HR Admin', 'Create cycle', "coalesce(template_name::text, id::text)", { nativeRoute: route('/admin/performance') }),
    config('performance_reviews', schemaTable('hr_performance', 'performance_reviews'), 'Performance review', 'Manager', 'Submit review and 360 feedback', 'id::text', { nativeRoute: route('/admin/performance') }),
    config('goals', schemaTable('hr_performance', 'goals'), 'Goal', 'Employee', 'Submit review and 360 feedback', "coalesce(title::text, id::text)", { nativeRoute: route('/admin/performance') }),
    config('objectives', schemaTable('hr_performance', 'objectives'), 'Objective', 'Manager', 'Submit review and 360 feedback', "coalesce(title::text, id::text)", { nativeRoute: route('/admin/performance') }),
    config('performance_improvement_plans', schemaTable('hr_performance', 'performance_improvement_plans'), 'Improvement plan', 'HR Admin', 'Generate analytics', 'id::text', { nativeRoute: route('/admin/performance') }),
  ],
  learning: [
    config('learning_courses', schemaTable('hr_learning', 'learning_courses'), 'Course', 'Learning Admin', 'Publish course', 'id::text'),
    config('learning_assignments', schemaTable('hr_learning', 'learning_assignments'), 'Learning assignment', 'Manager', 'Assign learning', 'id::text'),
    config('certifications', schemaTable('hr_learning', 'certifications'), 'Certification', 'Learning Admin', 'Renew certification', 'id::text'),
    config('learning_content_packages', schemaTable('hr_learning', 'learning_content_packages'), 'Content package', 'Learning Admin', 'Publish course', 'id::text'),
  ],
  'skills-talent': [
    config('skill_profiles', schemaTable('hr_skills', 'skill_profiles'), 'Skill profile', 'Employee', 'Update skills', 'id::text'),
    config('talent_pools', schemaTable('hr_skills', 'talent_pools'), 'Talent pool', 'Talent Admin', 'Nominate talent', 'id::text'),
    config('career_paths', schemaTable('hr_skills', 'career_paths'), 'Career path', 'Talent Admin', 'Build succession slate', 'id::text'),
    config('succession_plans', schemaTable('hr_skills', 'succession_plans'), 'Succession plan', 'Talent Admin', 'Track readiness', 'id::text'),
  ],
  engagement: [
    config('engagement_surveys', schemaTable('hr_engagement', 'engagement_surveys'), 'Survey', 'HR Admin', 'Publish survey', 'id::text'),
    config('survey_responses', schemaTable('hr_engagement', 'survey_responses'), 'Survey response', 'Employee', 'Collect anonymous response', 'id::text'),
    config('recognition_programs', schemaTable('hr_engagement', 'recognition_programs'), 'Recognition program', 'HR Admin', 'Award recognition', 'id::text'),
    config('recognition_records', schemaTable('hr_engagement', 'recognition_records'), 'Recognition record', 'Manager', 'Award recognition', 'id::text'),
  ],
  'employee-relations': [
    config('employee_relations_cases', schemaTable('hr_er', 'employee_relations_cases'), 'ER case', 'ER Specialist', 'Open case', 'case_number'),
    config('er_investigations', schemaTable('hr_er', 'er_investigations'), 'Investigation', 'ER Specialist', 'Start investigation', "'Investigation - ' || er_case_id::text"),
    config('disciplinary_actions', schemaTable('hr_er', 'disciplinary_actions'), 'Disciplinary action', 'HR Admin', 'Resolve or discipline', "action_type || ' - ' || worker_id::text"),
    config('accommodation_cases', schemaTable('hr_er', 'accommodation_cases'), 'Accommodation case', 'HR Admin', 'Review evidence', "request_type || ' - ' || worker_id::text"),
  ],
  compliance: [
    config('policy_documents', schemaTable('hr_compliance', 'policy_documents'), 'Policy document', 'Compliance Admin', 'Publish policy', "title || ' v' || document_version", { nativeRoute: route('/admin/compliance') }),
    config('policy_acknowledgements', schemaTable('hr_compliance', 'policy_acknowledgements'), 'Policy acknowledgement', 'Employee', 'Collect acknowledgement', "'Acknowledgement - ' || worker_id::text", { nativeRoute: route('/admin/compliance') }),
    config('legal_holds', schemaTable('hr_compliance', 'legal_holds'), 'Legal hold', 'Legal', 'Place legal hold', 'hold_name', { nativeRoute: route('/admin/compliance') }),
    config('statutory_reports', schemaTable('hr_compliance', 'statutory_reports'), 'Statutory report', 'Compliance Admin', 'Generate statutory report', "report_type || ' - ' || reporting_period", { nativeRoute: route('/admin/compliance') }),
  ],
  'global-hr': [
    config('country_rule_sets', schemaTable('hr_global', 'country_rule_sets'), 'Country rule set', 'Global HR', 'Configure country rules', "country_code || ' - ' || rule_set_type || ' v' || version"),
    config('statutory_leave_types', schemaTable('hr_global', 'statutory_leave_types'), 'Statutory leave type', 'Global HR', 'Configure country rules', "country_code || ' - ' || leave_type_name"),
    config('works_council_consultations', schemaTable('hr_global', 'works_council_consultations'), 'Works council consultation', 'Legal', 'Run works council consultation', "country_code || ' - ' || action_type"),
    config('work_authorization_cases', schemaTable('hr_global', 'work_authorization_cases'), 'Work authorization case', 'Compliance Admin', 'Validate work authorization', "authorization_type || ' - ' || worker_id::text"),
  ],
  'country-policy': [
    config('policy_packs', schemaTable('hr_country_policy', 'policy_packs'), 'Country policy pack', 'Country HR', 'Validate country pack', "country_code || ' v' || country_pack_version", { nativeRoute: route('/admin/country-policy') }),
    config('validation_runs', schemaTable('hr_country_policy', 'validation_runs'), 'Validation run', 'Compliance Admin', 'Validate country pack', "validation_type || ' - ' || policy_pack_id::text", { nativeRoute: route('/admin/country-policy') }),
    config('impact_simulations', schemaTable('hr_country_policy', 'impact_simulations'), 'Impact simulation', 'Compliance Admin', 'Simulate impact', "risk_level || ' - ' || policy_pack_id::text", { nativeRoute: route('/admin/country-policy') }),
  ],
  'dei-analytics': [
    config('dei_reports', schemaTable('hr_dei', 'dei_reports'), 'DEI report', 'DEI Lead', 'Generate DEI report', "report_type || ' - ' || reporting_period"),
    config('pay_gap_reports', schemaTable('hr_dei', 'pay_gap_reports'), 'Pay gap report', 'HR Analytics', 'Review pay gap', "report_type || ' - ' || reporting_year::text"),
    config('pay_equity_reviews', schemaTable('hr_dei', 'pay_equity_reviews'), 'Pay equity review', 'Legal', 'Plan remediation', "review_name || ' - ' || review_period"),
    config('attrition_segment_reports', schemaTable('hr_dei', 'attrition_segment_reports'), 'Attrition segment report', 'HR Analytics', 'Publish suppressed analytics', "segment_type || ' - ' || report_period"),
  ],
  'hr-ai-governance': [
    config('hr_ai_use_cases', schemaTable('hr_ai', 'hr_ai_use_cases'), 'AI use case', 'AI Governance', 'Register AI use case', 'use_case_name'),
    config('hr_ai_model_runs', schemaTable('hr_ai', 'hr_ai_model_runs'), 'Model run', 'AI Governance', 'Run bias test', "model_version || ' - ' || use_case_id::text"),
    config('hr_ai_bias_tests', schemaTable('hr_ai', 'hr_ai_bias_tests'), 'Bias test', 'Legal', 'Run bias test', "test_type || ' - ' || use_case_id::text"),
    config('hr_ai_kill_switches', schemaTable('hr_ai', 'hr_ai_kill_switches'), 'Kill switch', 'HR Admin', 'Activate kill switch', "trigger_reason || ' - ' || use_case_id::text"),
  ],
  reporting: [
    config('report_definitions', schemaTable('hr_reporting', 'report_definitions'), 'Report definition', 'HR Analyst', 'Design report', 'report_name'),
    config('report_executions', schemaTable('hr_reporting', 'report_executions'), 'Report execution', 'HR Analyst', 'Run report', "'Execution - ' || report_definition_id::text"),
    config('report_schedules', schemaTable('hr_reporting', 'report_schedules'), 'Report schedule', 'HR Admin', 'Schedule delivery', "frequency || ' - ' || report_definition_id::text"),
    config('calculated_fields', schemaTable('hr_reporting', 'calculated_fields'), 'Calculated field', 'HR Analyst', 'Create calculated field', 'field_name'),
  ],
  'service-delivery': [
    config('hr_service_cases', schemaTable('hr_service_delivery', 'hr_service_cases'), 'Service case', 'HR Service Agent', 'Open HR case', "case_number || ' - ' || case_type"),
    config('hr_case_tasks', schemaTable('hr_service_delivery', 'hr_case_tasks'), 'Case task', 'HR Service Agent', 'Assign task', 'title'),
    config('hr_knowledge_articles', schemaTable('hr_service_delivery', 'hr_knowledge_articles'), 'Knowledge article', 'HR Service Agent', 'Resolve with knowledge article', 'title'),
    config('hr_service_catalog_items', schemaTable('hr_service_delivery', 'hr_service_catalog_items'), 'Service catalog item', 'HR Service Agent', 'Open HR case', "service_code || ' - ' || service_name"),
    config('hr_case_sla_instances', schemaTable('hr_service_delivery', 'hr_case_sla_instances'), 'SLA instance', 'Manager', 'Track SLA', "'SLA - ' || case_id::text"),
  ],
  'contingent-workforce': [
    config('contingent_worker_assignments', schemaTable('hr_contingent', 'contingent_worker_assignments'), 'Contingent assignment', 'Procurement', 'Activate contractor', "worker_id::text || ' - ' || project_id::text"),
    config('sow_engagements', schemaTable('hr_contingent', 'sow_engagements'), 'SOW engagement', 'Procurement', 'Start SOW', "sow_number || ' - ' || project_name"),
    config('contractor_rate_cards', schemaTable('hr_contingent', 'contractor_rate_cards'), 'Rate card', 'HR Admin', 'Revise rate card', "job_title || ' - ' || rate::text || ' ' || currency"),
    config('misclassification_assessments', schemaTable('hr_contingent', 'misclassification_assessments'), 'Misclassification assessment', 'Legal', 'Clear or flag classification risk', "worker_id::text || ' risk ' || coalesce(risk_score::text, 'unscored')"),
  ],
  'wellbeing-eap': [
    config('eap_referrals', schemaTable('hr_wellbeing', 'eap_referrals'), 'EAP referral', 'Wellbeing Lead', 'Refer to EAP', "reason || ' - ' || worker_id::text"),
    config('wellness_programs', schemaTable('hr_wellbeing', 'wellness_programs'), 'Wellness program', 'Benefits Admin', 'Enroll in wellness program', 'name'),
    config('mental_health_cases', schemaTable('hr_wellbeing', 'mental_health_cases'), 'Mental health case', 'Wellbeing Lead', 'Submit claim', "severity || ' - ' || worker_id::text"),
  ],
  'union-labor': [
    config('union_recognitions', schemaTable('hr_union', 'union_recognitions'), 'Union recognition', 'Labor Relations', 'Ratify agreement', 'union_name'),
    config('grievances', schemaTable('hr_union', 'grievances'), 'Grievance', 'Labor Relations', 'Acknowledge grievance', "grievance_type || ' - ' || worker_id::text"),
    config('collective_bargaining_sessions', schemaTable('hr_union', 'collective_bargaining_sessions'), 'Collective bargaining session', 'Legal', 'Arbitrate or resolve', "session_date::text || ' - ' || union_recognition_id::text"),
  ],
};

export function nativeOperationModuleIds(): string[] {
  return Object.keys(NATIVE_SOURCE_REGISTRY).sort();
}

export function nativeOperationSourceKeys(moduleId: string): string[] {
  return (NATIVE_SOURCE_REGISTRY[moduleId] ?? []).map((source) => source.sourceKey);
}

function mapNativeStatus(status: string | null): OperationRecordStatus {
  const value = (status ?? '').toUpperCase();
  if (value.includes('DRAFT')) return 'Draft';
  if (['PENDING', 'QUEUED', 'SUBMITTED', 'REQUESTED', 'IN_REVIEW', 'PROCESSING'].some((token) => value.includes(token))) return 'In Review';
  if (['REJECTED', 'FAILED', 'CANCELLED', 'CANCELED', 'BLOCKED', 'SUSPENDED', 'DECLINED'].some((token) => value.includes(token))) return 'Blocked';
  if (['CLOSED', 'COMPLETED', 'RESOLVED', 'ARCHIVED', 'EXPIRED', 'PAID', 'PUBLISHED', 'TERMINATED', 'PROCESSED'].some((token) => value.includes(token))) return 'Closed';
  return 'Active';
}

function mapNativeRisk(status: string | null): OperationRisk {
  const value = (status ?? '').toUpperCase();
  if (['FAILED', 'REJECTED', 'BLOCKED', 'SUSPENDED', 'DECLINED', 'LEGAL_HOLD'].some((token) => value.includes(token))) return 'High';
  if (['DRAFT', 'PENDING', 'QUEUED', 'SUBMITTED', 'REQUESTED', 'PROCESSING', 'IN_REVIEW'].some((token) => value.includes(token))) return 'Medium';
  return 'Low';
}

function nativeRouteFor(config: NativeSourceConfig, row: NativeOperationRow): string | undefined {
  if (!config.nativeRoute) return undefined;
  if (config.sourceKey === 'workers' && config.nativeRoute === '/admin/employees') return `${config.nativeRoute}/${row.id}`;
  return config.nativeRoute;
}

export function nativeStatusCommandForOperation(
  moduleId: string,
  nativeSource: string,
  nativeRecordId: string,
  status: OperationRecordStatus,
  actor?: HrActor,
  operationAction?: NativeOperationAction,
): NativeStatusCommand | undefined {
  if (!Uuid.isValid(nativeRecordId)) return undefined;

  if (moduleId === 'compensation' && nativeSource === 'compensation_plans' && status === 'Active') {
    const planId = new Uuid(nativeRecordId);
    return {
      commandName: 'ActivateCompensationPlan',
      aggregateType: 'CompensationPlan',
      aggregateId: planId,
      payload: { planId },
    };
  }

  if (moduleId === 'compensation' && nativeSource === 'compensation_changes' && status === 'Closed' && actor?.actorId) {
    const changeId = new Uuid(nativeRecordId);
    return {
      commandName: 'ApproveCompensationChange',
      aggregateType: 'CompensationChange',
      aggregateId: changeId,
      payload: { changeId, approvedBy: actor.actorId },
    };
  }

  if (moduleId === 'benefits' && nativeSource === 'benefits_enrollments' && (operationAction === 'reject' || status === 'Blocked')) {
    const enrollmentId = new Uuid(nativeRecordId);
    return {
      commandName: 'RejectBenefitsEnrollment',
      aggregateType: 'BenefitsEnrollment',
      aggregateId: enrollmentId,
      payload: {
        enrollmentId,
        rejectedBy: actor?.actorId,
        reason: 'Rejected via admin module operations',
      },
    };
  }

  if (moduleId === 'benefits' && nativeSource === 'benefits_life_events' && (operationAction === 'reject' || status === 'Blocked')) {
    const lifeEventId = new Uuid(nativeRecordId);
    return {
      commandName: 'RejectBenefitsLifeEvent',
      aggregateType: 'BenefitsLifeEvent',
      aggregateId: lifeEventId,
      payload: {
        lifeEventId,
        rejectedBy: actor?.actorId,
        reason: 'Rejected via admin module operations',
      },
    };
  }

  if (moduleId === 'benefits' && nativeSource === 'benefits_enrollments' && operationAction === 'make-effective') {
    const enrollmentId = new Uuid(nativeRecordId);
    return {
      commandName: 'MakeEffectiveBenefitsEnrollment',
      aggregateType: 'BenefitsEnrollment',
      aggregateId: enrollmentId,
      payload: { enrollmentId },
    };
  }

  if (moduleId === 'benefits' && nativeSource === 'benefits_enrollments' && (operationAction === 'approve' || status === 'Active')) {
    const enrollmentId = new Uuid(nativeRecordId);
    return {
      commandName: 'ApproveBenefitsEnrollment',
      aggregateType: 'BenefitsEnrollment',
      aggregateId: enrollmentId,
      payload: { enrollmentId, approvedBy: actor?.actorId },
    };
  }

  if (moduleId === 'benefits' && nativeSource === 'benefits_enrollments' && (operationAction === 'terminate' || status === 'Closed')) {
    const enrollmentId = new Uuid(nativeRecordId);
    return {
      commandName: 'TerminateBenefitsEnrollment',
      aggregateType: 'BenefitsEnrollment',
      aggregateId: enrollmentId,
      payload: { enrollmentId, reason: 'Closed via admin module operations' },
    };
  }

  if (moduleId === 'benefits' && nativeSource === 'benefits_life_events' && (operationAction === 'process' || status === 'Closed')) {
    const lifeEventId = new Uuid(nativeRecordId);
    return {
      commandName: 'ProcessBenefitsLifeEvent',
      aggregateType: 'BenefitsLifeEvent',
      aggregateId: lifeEventId,
      payload: { lifeEventId, processedBy: actor?.actorId },
    };
  }

  return undefined;
}

@Injectable()
export class NativeModuleOperationAdapterService {
  private readonly db: Kysely<Database>;
  private readonly logger = new Logger(NativeModuleOperationAdapterService.name);

  constructor(
    private readonly operationsRepository: AdminModuleOperationsRepository,
    private readonly commandBus: CommandBus,
  ) {
    this.db = createKyselyInstance(getPool());
  }

  async syncNativeRecords(tenantId: Uuid, moduleId: string, actorId?: string): Promise<number> {
    const sources = NATIVE_SOURCE_REGISTRY[moduleId] ?? [];
    let synced = 0;

    for (const source of sources) {
      const rows = await this.readNativeRows(tenantId, source);
      for (const row of rows) {
        await this.operationsRepository.upsertNativeRecord({
          tenantId,
          moduleId,
          objectType: source.objectType,
          ownerRole: source.ownerRole,
          workflowName: source.workflowName,
          status: mapNativeStatus(row.native_status),
          risk: mapNativeRisk(row.native_status),
          lastEvent: `${source.objectType} synced from ${source.sourceKey}${row.native_status ? ` (${row.native_status})` : ''}`,
          source: 'native',
          nativeSource: source.sourceKey,
          nativeRecordId: row.id,
          nativeRoute: nativeRouteFor(source, row),
          payload: {
            nativeLabel: row.native_label ?? row.id,
            nativeStatus: row.native_status,
            nativeSource: source.sourceKey,
            sourceTable: source.tableExpression.replaceAll('"', ''),
            syncedAt: new Date().toISOString(),
          },
          actorId,
        });
        synced += 1;
      }
    }

    return synced;
  }

  async applyRecordStatusUpdate(
    tenantId: Uuid,
    moduleId: string,
    nativeSource: string,
    nativeRecordId: string,
    status: OperationRecordStatus,
    actor?: HrActor,
    operationAction?: NativeOperationAction,
  ): Promise<boolean> {
    if (!actor) return false;
    const command = nativeStatusCommandForOperation(moduleId, nativeSource, nativeRecordId, status, actor, operationAction);
    if (!command) return false;

    try {
      const subjectWorkerId = await this.resolveNativeSubjectWorkerId(tenantId, moduleId, nativeSource, nativeRecordId);
      const payload = subjectWorkerId ? { ...command.payload, workerId: subjectWorkerId } : command.payload;
      const envelope: HrCommandEnvelope<Record<string, unknown>> = {
        commandId: Uuid.generate(),
        commandName: command.commandName,
        commandSchemaVersion: 1,
        tenantId,
        actor,
        subjectWorkerId,
        aggregateType: command.aggregateType,
        aggregateId: command.aggregateId,
        idempotencyKey: crypto.randomUUID(),
        correlationId: Uuid.generate(),
        reason: `${command.commandName} via admin module operations`,
        payload,
        metadata: {
          requestHash: computeRequestHash(payload),
          clientType: 'HR_ADMIN',
          hrDataSensitivity: moduleId === 'benefits' ? 'LOW' : undefined,
        },
      };
      const result = await this.commandBus.execute(envelope);
      return result.success === true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not update native source ${nativeSource} for module ${moduleId}: ${message}`);
      return false;
    }
  }

  private async resolveNativeSubjectWorkerId(
    tenantId: Uuid,
    moduleId: string,
    nativeSource: string,
    nativeRecordId: string,
  ): Promise<Uuid | undefined> {
    const table = benefitsWorkerContextTable(moduleId, nativeSource);
    if (!table) return undefined;

    const result = await sql<{ worker_id: string | null }>`
      select worker_id::text as worker_id
      from ${sql.raw(table)}
      where tenant_id = ${tenantId.value}::uuid
        and id = ${nativeRecordId}::uuid
      limit 1
    `.execute(this.db);
    const workerId = result.rows[0]?.worker_id;
    return workerId && Uuid.isValid(workerId) ? new Uuid(workerId) : undefined;
  }

  private async readNativeRows(tenantId: Uuid, source: NativeSourceConfig): Promise<NativeOperationRow[]> {
    try {
      const query = sql<NativeOperationRow>`
        select
          id::text as id,
          (${sql.raw(source.labelExpression)})::text as native_label,
          (${sql.raw(source.statusExpression ?? 'status')})::text as native_status,
          created_at,
          updated_at
        from ${sql.raw(source.tableExpression)}
        where tenant_id = ${tenantId.value}::uuid
        order by updated_at desc nulls last, created_at desc nulls last
        limit ${DEFAULT_LIMIT_PER_SOURCE}
      `;
      const result = await query.execute(this.db);
      return result.rows;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Skipping native source ${source.sourceKey} for module ${source.tableExpression}: ${message}`);
      return [];
    }
  }
}

export function benefitsWorkerContextTable(moduleId: string, nativeSource: string): string | undefined {
  if (moduleId !== 'benefits') return undefined;
  if (nativeSource === 'benefits_enrollments') return schemaTable('hr_benefits', 'benefits_enrollments');
  if (nativeSource === 'benefits_life_events') return schemaTable('hr_benefits', 'benefits_life_events');
  return undefined;
}
