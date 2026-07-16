import type { ColumnType } from 'kysely';

export interface TenantsTable {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AuditLogTable {
  id: string;
  tenant_id: string;
  actor_type: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  payload: unknown;
  occurred_at: Date;
  correlation_id: string | null;
}

export interface IdempotencyKeysTable {
  id: string;
  tenant_id: string;
  key: string;
  hash: string;
  status: string;
  command_name: string;
  aggregate_type: string;
  aggregate_id: string | null;
  result: unknown | null;
  error: unknown | null;
  created_at: ColumnType<Date, string | undefined, never>;
  expires_at: Date | null;
}

export interface TransitionLedgersTable {
  id: string;
  tenant_id: string;
  aggregate_type: string;
  aggregate_id: string;
  from_state: string;
  to_state: string;
  action: string;
  triggered_by: string;
  occurred_at: Date;
  correlation_id: string | null;
  decision_record_id: string | null;
  command_id: string;
}

export interface OutboxEventsTable {
  id: string;
  tenant_id: string;
  event_name: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  metadata: unknown;
  event_schema_version: number;
  event_topic: string | null;
  envelope_version: number;
  correlation_id: string | null;
  causation_id: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  published_at: Date | null;
  publish_attempt_count: number;
  last_error: string | null;
}

export interface InboxEventsTable {
  id: string;
  tenant_id: string;
  consumer_name: string;
  consumer_version: string;
  source_event_id: string;
  source_topic: string;
  source_partition: number;
  source_offset: number;
  event_name: string;
  aggregate_type: string;
  aggregate_id: string;
  processing_status: string;
  retry_count: number;
  next_retry_at: Date | null;
  error_summary: string | null;
  processed_at: Date | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface PlatformNotificationsTable {
  id: string;
  tenant_id: string;
  audience: string;
  recipient_worker_id: string | null;
  recipient_role: string | null;
  category: string;
  title: string;
  body: string;
  source_event_id: string;
  source_event_name: string;
  related_aggregate_type: string;
  related_aggregate_id: string;
  payload: unknown;
  delivery_status: string;
  read_at: Date | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface PlatformSchedulerJobRunsTable {
  id: string;
  tenant_id: string;
  job_name: string;
  period_key: string;
  status: string;
  items_processed: number;
  error: string | null;
  started_at: ColumnType<Date, string | Date | undefined, string | Date | undefined>;
  finished_at: ColumnType<Date | null, string | Date | null | undefined, string | Date | null | undefined>;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface PlatformSchedulerJobSchedulesTable {
  id: string;
  tenant_id: string;
  job_name: string;
  cron: string;
  enabled: boolean;
  updated_by: string | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ReminderDispatchLogTable {
  id: string;
  tenant_id: string;
  dispatch_key: string;
  reminder_type: string;
  subject_id: string;
  subject_type: string;
  due_date_bucket: string;
  escalation_tier: string;
  audience_worker_ids: string[];
  dispatched_at: ColumnType<Date, string | Date | undefined, string | Date | undefined>;
  expires_at: ColumnType<Date, string | Date, string | Date>;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface EffectiveDatingActivationLogTable {
  id: string;
  tenant_id: string;
  job_name: string;
  aggregate_type: string;
  aggregate_id: string;
  effective_date_bucket: string;
  command_name: string;
  status: string;
  error: string | null;
  dispatched_at: ColumnType<Date, string | Date | undefined, string | Date | undefined>;
  finished_at: ColumnType<Date | null, string | Date | null | undefined, string | Date | null | undefined>;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ApprovalChainsTable {
  id: string;
  tenant_id: string;
  command_name: string;
  aggregate_type: string;
  aggregate_id: string | null;
  requested_by: string;
  command_envelope: unknown;
  status: string;
  current_step_order: number | null;
  correlation_id: string;
  idempotency_key: string | null;
  completed_at: Date | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ApprovalStepsTable {
  id: string;
  tenant_id: string;
  chain_id: string;
  step_order: number;
  code: string;
  label: string;
  mode: string;
  approver_type: string;
  approver_role: string | null;
  approver_worker_id: string | null;
  state: string;
  delegated_to_worker_id: string | null;
  escalation_tier_code: string | null;
  escalation_tier_label: string | null;
  escalation_approver_role: string | null;
  sla_due_at: Date | null;
  acted_by: string | null;
  acted_at: Date | null;
  reason: string | null;
  escalation_tiers: unknown;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ApprovalDelegationsTable {
  id: string;
  tenant_id: string;
  chain_id: string;
  step_id: string;
  from_worker_id: string | null;
  to_worker_id: string;
  actor_id: string;
  reason: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface HcmSetupConfigsTable {
  id: string;
  tenant_id: string;
  config: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface RolesTable {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  tier: string;
  description: string | null;
  is_system: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface PermissionsTable {
  id: string;
  tenant_id: string;
  code: string;
  description: string | null;
  domain: string;
  data_classification: string | null;
  audit_on_access: boolean;
}

export interface RolePermissionsTable {
  role_id: string;
  permission_id: string;
}

export interface UserRolesTable {
  id: string;
  tenant_id: string;
  user_id: string;
  role_id: string | null;
  assigned_by: string | null;
  assigned_at: ColumnType<Date, string | undefined, never>;
  expires_at: Date | null;
}

export interface UsersTable {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  status: string;
  roles: unknown;
  permissions: unknown;
  mfa_secret: string | null;
  failed_login_count: number;
  locked_until: Date | null;
  idp_provider: string | null;
  external_id: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface SavedViewsTable {
  id: string;
  tenant_id: string;
  user_id: string;
  list_key: string;
  name: string;
  filters: unknown;
  columns: unknown;
  is_default: boolean;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface TenantIdentityProvidersTable {
  id: string;
  tenant_id: string;
  protocol: string;
  display_name: string;
  enabled: boolean;
  jit_provisioning: boolean;
  default_roles: unknown;
  attribute_mapping: unknown;
  group_role_mapping: unknown;
  oidc_issuer_url: string | null;
  oidc_client_id: string | null;
  oidc_client_secret_enc: string | null;
  oidc_scopes: unknown;
  saml_idp_entity_id: string | null;
  saml_idp_sso_url: string | null;
  saml_idp_x509_cert: string | null;
  saml_sp_private_key_enc: string | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface SsoAuthTransactionsTable {
  id: string;
  tenant_id: string;
  provider_id: string;
  protocol: string;
  state: string;
  pkce_verifier: string | null;
  nonce: string | null;
  relay_state: string | null;
  redirect_uri: string | null;
  expires_at: ColumnType<Date, string | Date, string | Date>;
  consumed_at: ColumnType<Date | null, string | Date | null | undefined, string | Date | null | undefined>;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AuthSessionsTable {
  id: string;
  tenant_id: string;
  user_id: string;
  mfa_authenticated: boolean;
  metadata: unknown;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AuthTokensTable {
  id: string;
  tenant_id: string;
  user_id: string;
  token_hash: string;
  token_type: string;
  email: string | null;
  metadata: unknown;
  expires_at: Date;
  consumed_at: Date | null;
  created_by: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ServiceAccountsTable {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  owner_worker_id: string | null;
  status: string;
  scopes: unknown;
  credential_rotation_days: number;
  last_rotated_at: Date | null;
  expires_at: Date | null;
  created_by: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ServiceAccountCredentialsTable {
  id: string;
  tenant_id: string;
  service_account_id: string;
  name: string;
  secret_hash: string;
  secret_prefix: string;
  status: string;
  scopes: unknown;
  issued_at: ColumnType<Date, string | undefined, never>;
  expires_at: Date | null;
  last_used_at: Date | null;
  rotated_at: Date | null;
  revoked_at: Date | null;
  revoked_reason: string | null;
  created_by: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AccessReviewCampaignsTable {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  scope: unknown;
  reviewer_role: string;
  status: string;
  due_at: Date | null;
  created_by: string | null;
  launched_at: Date | null;
  last_reminder_at: Date | null;
  escalated_at: Date | null;
  escalation_count: number;
  completed_at: Date | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AccessReviewItemsTable {
  id: string;
  tenant_id: string;
  campaign_id: string;
  subject_user_id: string | null;
  subject_worker_id: string | null;
  role_id: string | null;
  permission_id: string | null;
  service_account_id: string | null;
  decision: string;
  reviewer_id: string | null;
  reviewed_at: Date | null;
  evidence: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AccessReviewWorkflowEventsTable {
  id: string;
  tenant_id: string;
  campaign_id: string;
  event_type: string;
  actor_id: string | null;
  target_role: string | null;
  message: string | null;
  pending_item_count: number;
  payload: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AbacPoliciesTable {
  id: string;
  tenant_id: string;
  dimension: string;
  conditions: unknown;
  effect: string;
  priority: number;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface FieldAccessPoliciesTable {
  id: string;
  tenant_id: string;
  field_path: string;
  data_classification: string;
  role_decisions: unknown;
  self_service_decision: string | null;
  manager_decision: string | null;
  masking_rule: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface SodRulesTable {
  id: string;
  tenant_id: string;
  code: string;
  description: string | null;
  incompatible_role_pairs: unknown | null;
  incompatible_permission_pairs: unknown | null;
  enforcement_point: string | null;
  break_glass_allowed: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AdminPolicyRevisionsTable {
  id: string;
  tenant_id: string;
  area: string;
  title: string;
  status: string;
  baseline_config: unknown;
  draft_config: unknown;
  validation_result: unknown | null;
  simulation_result: unknown | null;
  created_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  published_by: string | null;
  applied_by: string | null;
  review_notes: string | null;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  approved_at: Date | null;
  published_at: Date | null;
  applied_at: Date | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AdminPolicyRevisionScopesTable {
  id: string;
  tenant_id: string;
  revision_id: string;
  country_codes: unknown;
  legal_entity_ids: unknown;
  branch_codes: unknown;
  org_unit_ids: unknown;
  department_ids: unknown;
  job_codes: unknown;
  grade_codes: unknown;
  location_codes: unknown;
  employee_types: unknown;
  manager_worker_ids: unknown;
  worker_ids: unknown;
  effective_from: Date | null;
  effective_until: Date | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AdminPolicyApplicationRunsTable {
  id: string;
  tenant_id: string;
  revision_id: string;
  status: string;
  impacted_employees: number;
  pending_records: unknown;
  applied_by: string;
  applied_at: ColumnType<Date, string | undefined, never>;
  runtime_snapshot: unknown;
}

export interface AdminPolicyImpactResultsTable {
  id: string;
  tenant_id: string;
  revision_id: string;
  simulation_result: unknown;
  created_by: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AdminPolicyDecisionEvidenceTable {
  id: string;
  tenant_id: string;
  policy_revision_id: string;
  service_area: string;
  engine_name: string;
  engine_version: string;
  scope_match: unknown;
  decision: string;
  reason: string;
  subject_worker_id: string | null;
  source_record_id: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AdminModuleOperationRecordsTable {
  id: string;
  tenant_id: string;
  module_id: string;
  object_type: string;
  owner_role: string;
  workflow_name: string;
  status: string;
  risk: string;
  last_event: string;
  source: string;
  native_source: string | null;
  native_record_id: string | null;
  native_route: string | null;
  payload: unknown;
  created_by: string | null;
  updated_by: string | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AdminModuleOperationWorkflowsTable {
  id: string;
  tenant_id: string;
  module_id: string;
  workflow_name: string;
  owner_role: string;
  state: string;
  sla_target: string;
  last_event: string;
  payload: unknown;
  created_by: string | null;
  updated_by: string | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AdminModuleOperationControlsTable {
  id: string;
  tenant_id: string;
  module_id: string;
  control_name: string;
  control_type: string;
  owner_role: string;
  status: string;
  last_event: string;
  payload: unknown;
  created_by: string | null;
  updated_by: string | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface GeneratedWorkflowTable {
  id: string;
  tenant_id: string;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
  [column: string]: unknown;
}

export interface SchedulerJobsTable {
  id: string;
  tenant_id: string;
  job_key: string;
  label: string;
  description: string | null;
  job_type: string;
  schedule_kind: string;
  status: string;
  enabled: boolean;
  command_name: string | null;
  aggregate_type: string;
  aggregate_id: string | null;
  payload_template: unknown;
  event_name: string | null;
  event_payload_template: unknown;
  next_run_at: Date | null;
  last_run_at: Date | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface SchedulerJobRunsTable {
  id: string;
  tenant_id: string;
  job_id: string;
  job_key: string;
  period_key: string;
  run_kind: string;
  status: string;
  idempotency_key: string;
  command_id: string | null;
  correlation_id: string;
  event_id: string | null;
  started_at: Date;
  finished_at: Date | null;
  error_message: string | null;
  result_payload: unknown;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface WorkersTable {
  id: string;
  tenant_id: string;
  employee_number: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  hire_date: Date;
  termination_date: Date | null;
  legal_entity_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  job_title: string | null;
  employment_type: string;
  aggregate_version: number;
  data_classification: string;
  legal_hold_status: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmploymentRelationshipsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  relationship_type: string;
  start_date: Date;
  end_date: Date | null;
  legal_entity_id: string | null;
  contract_type: string | null;
  probation_end_date: Date | null;
  state: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface JobAssignmentsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  position_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  job_title: string | null;
  start_date: Date;
  end_date: Date | null;
  assignment_type: string;
  state: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface EmploymentContractsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  contract_type: string;
  start_date: Date;
  end_date: Date | null;
  terms: unknown;
  signed_at: Date | null;
  state: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface PersonalDataRecordsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  data_category: string;
  data_classification: string;
  encrypted_payload_ref: string | null;
  payload: unknown | null;
  consent_status: string;
  state: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface PositionsTable {
  id: string;
  tenant_id: string;
  position_code: string;
  title: string;
  department_id: string | null;
  legal_entity_id: string | null;
  job_family: string | null;
  job_level: string | null;
  employment_type: string;
  status: string;
  filled_by_worker_id: string | null;
  headcount_request_id: string | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface HeadcountRequestsTable {
  id: string;
  tenant_id: string;
  request_number: string;
  department_id: string | null;
  legal_entity_id: string | null;
  justification: string;
  requested_by: string;
  approved_by: string | null;
  approved_at: Date | null;
  status: string;
  positions_requested: number;
  positions_approved: number | null;
  auto_create_position: boolean;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface LegalEntitiesTable {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  country_code: string;
  registration_number: string | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface OrgUnitsTable {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  legal_entity_id: string | null;
  level: number;
  path: string | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ManagerRelationshipsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  manager_id: string;
  department_id: string | null;
  is_primary: boolean;
  start_date: ColumnType<Date, string | undefined, never>;
  end_date: Date | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface JobRequisitionsTable {
  id: string;
  tenant_id: string;
  requisition_number: string;
  position_id: string;
  department_id: string | null;
  hiring_manager_id: string | null;
  recruiter_id: string | null;
  title: string;
  description: string | null;
  status: string;
  published_at: Date | null;
  filled_at: Date | null;
  closed_at: Date | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CandidatesTable {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  resume_url: string | null;
  source: string | null;
  status: string;
  requisition_id: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface InterviewPlansTable {
  id: string;
  tenant_id: string;
  candidate_id: string;
  requisition_id: string;
  interviewers: unknown;
  scheduled_at: Date | null;
  format: string | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface OffersTable {
  id: string;
  tenant_id: string;
  candidate_id: string;
  requisition_id: string;
  proposed_salary: string;
  currency: string;
  start_date: Date;
  benefits_package: unknown;
  status: string;
  sent_at: Date | null;
  accepted_at: Date | null;
  declined_at: Date | null;
  proposed_by: string | null;
  approved_by: string | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface OnboardingPlansTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  start_date: Date;
  assigned_buddy_id: string | null;
  mentor_id: string | null;
  role_track: string | null;
  preboarding_portal_status: string;
  first_day_instructions: unknown;
  welcome_message: string | null;
  probation_review_date: Date | null;
  probation_status: string;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface OnboardingTasksTable {
  id: string;
  tenant_id: string;
  onboarding_plan_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  owner_group: string;
  category: string;
  required: boolean;
  evidence_type: string | null;
  evidence_payload: unknown;
  provisioning_target: string | null;
  signing_provider_envelope_id: string | null;
  milestone_day: number | null;
  completion_notes: string | null;
  due_date: Date | null;
  completed_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface OnboardingTrackTemplatesTable {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  role_track: string;
  target_employment_types: unknown;
  country_codes: unknown;
  task_blueprint: unknown;
  active: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CompensationPlansTable {
  id: string;
  tenant_id: string;
  name: string;
  plan_type: string;
  currency: string;
  effective_from: Date | null;
  effective_until: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CompensationBandsTable {
  id: string;
  tenant_id: string;
  band_code: string;
  job_level: string;
  job_family: string;
  min_salary: string;
  mid_salary: string;
  max_salary: string;
  currency: string;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CompensationChangesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  change_type: string;
  old_amount: string | null;
  new_amount: string;
  currency: string;
  effective_date: Date;
  approved_by: string | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface BonusCyclesTable {
  id: string;
  tenant_id: string;
  cycle_name: string;
  cycle_year: number;
  eligibility_date: Date;
  payment_date: Date;
  total_pool_amount: string;
  currency: string;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface EquityGrantsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  grant_type: string;
  grant_date: Date;
  vesting_schedule: unknown;
  total_units: string;
  vested_units: string;
  exercised_units: string;
  strike_price: string | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface VariableCompPlansTable {
  id: string;
  tenant_id: string;
  name: string;
  plan_type: string;
  target_percentage: string;
  max_percentage: string;
  currency: string;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface PayScalesTable {
  id: string;
  tenant_id: string;
  scale_code: string;
  grade: string;
  steps: unknown;
  currency: string;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface TotalCompensationStatementsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  statement_year: number;
  base_salary: string;
  bonus_amount: string;
  equity_value: string;
  benefits_value: string;
  total_comp: string;
  currency: string;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface BenefitsProgramsTable {
  id: string;
  tenant_id: string;
  program_name: string;
  program_type: string;
  carrier_id: string | null;
  effective_from: Date | null;
  effective_until: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface BenefitsEnrollmentsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  program_id: string;
  coverage_level: string;
  dependents: unknown;
  effective_date: Date;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface BenefitsLifeEventsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  event_type: string;
  event_date: Date;
  description: string | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface SpendingAccountsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  account_type: string;
  annual_election: string;
  used_amount: string;
  available_amount: string;
  currency: string;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CarrierReconciliationRunsTable {
  id: string;
  tenant_id: string;
  carrier_id: string;
  period_start: Date;
  period_end: Date;
  total_premium: string;
  total_collected: string;
  variance_amount: string;
  currency: string;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface PolicyDocumentsTable {
  id: string;
  tenant_id: string;
  title: string;
  document_type: string;
  document_version: string;
  content: unknown;
  effective_from: Date | null;
  effective_until: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface PolicyAcknowledgementsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  policy_document_id: string;
  acknowledged_at: Date | null;
  due_date: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface LegalHoldsTable {
  id: string;
  tenant_id: string;
  hold_name: string;
  description: string | null;
  reason: string;
  affected_worker_ids: unknown;
  placed_by: string;
  placed_at: Date;
  released_by: string | null;
  released_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface StatutoryReportsTable {
  id: string;
  tenant_id: string;
  report_type: string;
  reporting_period: string;
  country_code: string;
  legal_entity_id: string;
  content: unknown;
  submitted_at: Date | null;
  filed_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CountryRuleSetsTable {
  id: string;
  tenant_id: string;
  country_code: string;
  rule_set_type: string;
  version: string;
  effective_from: Date | null;
  effective_until: Date | null;
  rules: unknown;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface StatutoryLeaveTypesTable {
  id: string;
  tenant_id: string;
  country_code: string;
  leave_type_code: string;
  leave_type_name: string;
  minimum_entitlement: string;
  unit: string;
  carryover_allowed: boolean;
  max_carryover: string;
  effective_from: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface WorksCouncilConsultationsTable {
  id: string;
  tenant_id: string;
  country_code: string;
  legal_entity_id: string;
  action_type: string;
  consultation_type: string;
  initiated_at: Date | null;
  deadline_date: Date | null;
  completed_at: Date | null;
  blocking_until: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface WorkAuthorizationCasesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  authorization_type: string;
  issuing_country: string;
  document_number: string | null;
  valid_from: Date | null;
  valid_until: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface InternationalAssignmentsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  home_country: string;
  host_country: string;
  legal_entity_id: string | null;
  start_date: Date;
  end_date: Date;
  assignment_reason: string;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CountryPolicyPacksTable {
  id: string;
  tenant_id: string;
  country_code: string;
  country_pack_version: string;
  effective_from: Date | null;
  effective_until: Date | null;
  status: string;
  sections: unknown;
  required_approvals: unknown;
  completed_reviews: unknown;
  source_evidence: unknown;
  recalculation_required: boolean;
  uploaded_by: string | null;
  uploaded_at: Date | null;
  published_at: Date | null;
  published_by: string | null;
  superseded_by: string | null;
  rollback_reason: string | null;
  rejected_by: string | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CountryPolicyValidationRunsTable {
  id: string;
  tenant_id: string;
  policy_pack_id: string;
  validation_type: string;
  results: unknown;
  errors: unknown;
  started_at: Date | null;
  completed_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CountryPolicyImpactSimulationsTable {
  id: string;
  tenant_id: string;
  policy_pack_id: string;
  impacted_workers: unknown;
  impacted_payroll_runs: unknown;
  impacted_tax_assignments: unknown;
  impacted_leave_balances: unknown;
  impacted_benefits: unknown;
  risk_level: string | null;
  results: unknown;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface WorkSchedulesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  schedule_type: string;
  start_date: Date;
  end_date: Date | null;
  days_of_week: unknown;
  hours_per_day: string;
  timezone: string;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface TimesheetsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  period_start: Date;
  period_end: Date;
  entries: unknown;
  total_hours: string;
  status: string;
  submitted_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface TimeClockEventsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  event_type: string;
  timestamp: Date;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  accuracy_meters: string | null;
  workplace_code: string | null;
  distance_meters: string | null;
  geofence_radius_meters: string | null;
  geofence_profile_code: string | null;
  location_status: string | null;
  device_trust_level: string | null;
  trust_level: string | null;
  trust_score: string | null;
  trust_requires_approval: boolean | null;
  trust_reasons: string[] | null;
  device_id: string | null;
  capture_method: string | null;
  capture_device_kind: string | null;
  capture_reference: string | null;
  verification_status: string | null;
  capture_evidence: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface AttendanceExceptionsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  exception_type: string;
  description: string;
  detected_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface AttendanceDailyLedgersTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  employee_id: string;
  worker_name: string;
  work_date: Date;
  status: string;
  scheduled: boolean;
  holiday_name: string | null;
  first_check_in_at: Date | null;
  latest_check_out_at: Date | null;
  location_status: string;
  worked_minutes: number;
  payable_minutes: number;
  deduction_minutes: number;
  overtime_minutes: number;
  late_minutes: number;
  undertime_minutes: number;
  exception_count: number;
  ready_for_payroll: boolean;
  locked: boolean;
  locked_at: Date | null;
  locked_by: string | null;
  payroll_cycle_id: string | null;
  source_hash: string;
  ledger_payload: unknown;
  payroll_payload: unknown;
  governance: unknown;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface AttendanceCorrectionRequestsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  work_date: Date;
  correction_type: string;
  requested_event_type: string | null;
  requested_timestamp: Date | null;
  target_event_id: string | null;
  reason: string;
  status: string;
  requested_by: string;
  requested_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  applied_by: string | null;
  applied_at: Date | null;
  applied_event_id: string | null;
  audit_trail: unknown;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface OvertimeApprovalsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  requested_hours: string;
  reason: string;
  requested_at: Date;
  approved_by: string | null;
  approved_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface AbsenceRequestsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  absence_type: string;
  policy_code: string | null;
  start_date: Date;
  end_date: Date;
  duration_unit: string;
  duration_amount: string;
  start_time: string | null;
  end_time: string | null;
  paid: boolean;
  deduct_from_balance: boolean;
  payroll_impact: string;
  calendar_days: number;
  working_days: string;
  excluded_holiday_dates: unknown;
  reason: string | null;
  status: string;
  submitted_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface LeaveCasesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  leave_type: string;
  start_date: Date;
  expected_return_date: Date | null;
  actual_return_date: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface AbsenceAccrualBalancesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  leave_type: string;
  balance_hours: string;
  accrued_hours: string;
  used_hours: string;
  carried_over_hours: string;
  effective_date: Date;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface LeaveEntitlementCalculationsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  leave_type: string;
  calculated_entitlement: string;
  used_entitlement: string;
  remaining_entitlement: string;
  calculation_date: Date;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface PayrollCyclesTable {
  id: string;
  tenant_id: string;
  cycle_name: string;
  pay_period_start: Date;
  pay_period_end: Date;
  pay_date: Date | null;
  status: string;
  opened_at: Date | null;
  closed_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface PayrollInputsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  payroll_cycle_id: string;
  input_type: string;
  amount: string;
  currency: string;
  description: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface PayrollCalculationRunsTable {
  id: string;
  tenant_id: string;
  payroll_cycle_id: string;
  started_at: Date | null;
  completed_at: Date | null;
  total_workers: number;
  total_gross_pay: string;
  total_net_pay: string;
  currency: string;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface PayrollResultLinesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  payroll_cycle_id: string;
  calculation_run_id: string;
  line_type: string;
  description: string;
  amount: string;
  currency: string;
  rule_set_id: string | null;
  rule_id: string | null;
  explanation: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface PayrollPaymentBatchesTable {
  id: string;
  tenant_id: string;
  payroll_cycle_id: string;
  batch_number: string;
  status: string;
  period_start: Date;
  period_end: Date;
  pay_date: Date;
  currency: string;
  ready_count: number;
  blocked_count: number;
  total_net: string;
  file_hash: string;
  payload: unknown;
  created_by: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  exported_at: Date | null;
  reconciled_at: Date | null;
  bank_file_format: string | null;
  reconciliation_summary: unknown;
  workflow_events: unknown;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface PayrollPayslipArtifactsTable {
  id: string;
  tenant_id: string;
  payroll_cycle_id: string;
  worker_id: string;
  employee_id: string;
  artifact_format: string;
  status: string;
  gross_pay: string;
  net_pay: string;
  currency: string;
  content_hash: string;
  html_content: string;
  payslip_payload: unknown;
  data_classification: string;
  published_by: string | null;
  published_at: Date | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface PayrollExportJobsTable {
  id: string;
  tenant_id: string;
  payroll_cycle_id: string | null;
  export_type: string;
  status: string;
  requested_by: string | null;
  purpose: string;
  filters: unknown;
  row_count: number;
  file_name: string;
  file_hash: string;
  data_classification: string;
  aggregate_version: number;
  created_at: Date;
  completed_at: Date;
}

export interface PayrollGlPostingsTable {
  id: string;
  tenant_id: string;
  payroll_cycle_id: string;
  posting_number: string;
  status: string;
  total_debits: string;
  total_credits: string;
  currency: string;
  lines: unknown;
  source_hash: string;
  created_by: string | null;
  approved_by: string | null;
  posted_at: Date | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}



export interface ShiftSchedulesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  shift_date: Date;
  start_time: Date;
  end_time: Date;
  break_duration: number;
  department_id: string;
  workplace_code: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface OpenShiftsTable {
  id: string;
  tenant_id: string;
  department_id: string;
  workplace_code: string | null;
  shift_date: Date;
  start_time: Date;
  end_time: Date;
  required_skills: unknown;
  bid_deadline: Date | null;
  filled_by_worker_id: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ShiftBidsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  open_shift_id: string;
  bid_date: Date;
  approved_by: string | null;
  approved_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ShiftSwapRequestsTable {
  id: string;
  tenant_id: string;
  requester_worker_id: string;
  target_worker_id: string;
  original_shift_id: string;
  target_shift_id: string;
  reason: string | null;
  approved_by: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface WfmOvertimeApprovalsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  requested_hours: string;
  reason: string;
  shift_date: Date | null;
  requested_at: Date;
  approved_by: string | null;
  approved_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CoverageGapsTable {
  id: string;
  tenant_id: string;
  department_id: string;
  workplace_code: string | null;
  shift_date: Date;
  gap_start: Date;
  gap_end: Date;
  required_skills: unknown;
  unfilled_positions: number;
  filled_by_worker_id: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface EmployeeRelationsCasesTable {
  id: string;
  tenant_id: string;
  subject_worker_id: string;
  manager_id: string | null;
  case_number: string;
  case_type: string;
  status: string;
  opened_at: Date;
  opened_by: string;
  assigned_to: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ErInvestigationsTable {
  id: string;
  tenant_id: string;
  er_case_id: string;
  investigator_id: string;
  findings: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface DisciplinaryActionsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  er_case_id: string;
  action_type: string;
  severity: string;
  description: string | null;
  effective_date: Date;
  expiry_date: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface AccommodationCasesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  request_type: string;
  description: string | null;
  medical_documentation: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrServiceCasesTable {
  id: string;
  tenant_id: string;
  requester_worker_id: string;
  case_number: string;
  case_type: string;
  priority: string;
  description: string;
  status: string;
  assigned_to: string | null;
  sla_deadline: Date | null;
  resolved_at: Date | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrCaseTasksTable {
  id: string;
  tenant_id: string;
  case_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: Date | null;
  completed_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrKnowledgeArticlesTable {
  id: string;
  tenant_id: string;
  title: string;
  content: unknown;
  category: string;
  tags: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrServiceCatalogItemsTable {
  id: string;
  tenant_id: string;
  service_code: string;
  service_name: string;
  service_type: string;
  description: string | null;
  category: string | null;
  sla_hours: number | null;
  fulfillment_process: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrCaseSlaInstancesTable {
  id: string;
  tenant_id: string;
  case_id: string;
  sla_definition_id: string;
  target_hours: number;
  started_at: Date;
  breached_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ContingentWorkerAssignmentsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  vendor_id: string;
  project_id: string;
  start_date: Date;
  end_date: Date;
  rate: string;
  currency: string;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface SowEngagementsTable {
  id: string;
  tenant_id: string;
  sow_number: string;
  vendor_id: string;
  project_name: string;
  total_value: string;
  currency: string;
  start_date: Date;
  end_date: Date;
  milestones: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ContractorRateCardsTable {
  id: string;
  tenant_id: string;
  vendor_id: string;
  job_title: string;
  rate: string;
  currency: string;
  effective_from: Date;
  effective_until: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface MisclassificationAssessmentsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  assessment_date: Date;
  risk_score: string | null;
  risk_factors: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface EapReferralsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  reason: string;
  status: string;
  scheduled_date: Date | null;
  completed_date: Date | null;
  provider_id: string | null;
  notes: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface WellnessProgramsTable {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  status: string;
  start_date: Date | null;
  end_date: Date | null;
  description: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface MentalHealthCasesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  severity: string;
  status: string;
  provider_id: string | null;
  notes: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface UnionRecognitionsTable {
  id: string;
  tenant_id: string;
  union_name: string;
  bargaining_unit_id: string;
  status: string;
  effective_date: Date | null;
  expiration_date: Date | null;
  agreement_document: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface GrievancesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  grievance_type: string;
  description: string;
  status: string;
  resolution: string | null;
  arbitrator_decision: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CollectiveBargainingSessionsTable {
  id: string;
  tenant_id: string;
  union_recognition_id: string;
  session_date: Date;
  status: string;
  location: string | null;
  agenda: string | null;
  minutes: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ReportDefinitionsTable {
  id: string;
  tenant_id: string;
  report_name: string;
  report_type: string;
  data_source: string;
  query_definition: unknown;
  parameters: unknown;
  schedule: unknown;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ReportExecutionsTable {
  id: string;
  tenant_id: string;
  report_definition_id: string;
  executed_by: string;
  parameters: unknown;
  result_url: string | null;
  result_payload: unknown | null;
  row_count: number | null;
  started_at: Date | null;
  completed_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ReportSchedulesTable {
  id: string;
  tenant_id: string;
  report_definition_id: string;
  frequency: string;
  recipients: unknown;
  next_run_at: Date | null;
  last_run_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CalculatedFieldsTable {
  id: string;
  tenant_id: string;
  field_name: string;
  expression: string;
  data_type: string;
  source_fields: unknown;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface DeiReportsTable {
  id: string;
  tenant_id: string;
  report_type: string;
  reporting_period: string;
  country_code: string;
  legal_entity_id: string;
  metrics: unknown;
  aggregation_threshold: number;
  suppression_applied: boolean;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface PayGapReportsTable {
  id: string;
  tenant_id: string;
  report_type: string;
  reporting_year: number;
  country_code: string;
  mean_hourly_gap: string | null;
  median_hourly_gap: string | null;
  quartile_distribution: unknown;
  action_plan: unknown;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface PayEquityReviewsTable {
  id: string;
  tenant_id: string;
  review_name: string;
  review_period: string;
  scope: unknown;
  findings: unknown;
  remediation_actions: unknown;
  completed_actions: unknown;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AttritionSegmentReportsTable {
  id: string;
  tenant_id: string;
  report_period: string;
  segment_type: string;
  segments: unknown;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AttritionRiskSnapshotsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  period_key: string;
  model_key: string;
  model_version: string;
  score: string;
  band: string;
  factors: unknown;
  feature_snapshot: unknown;
  source_event_id: string | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AttendancePayrollAnomalySnapshotsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  period_key: string;
  model_key: string;
  model_version: string;
  score: string;
  band: string;
  anomaly_type: string;
  factors: unknown;
  feature_snapshot: unknown;
  notification_event_id: string | null;
  source_event_id: string | null;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface HrAiUseCasesTable {
  id: string;
  tenant_id: string;
  use_case_name: string;
  use_case_type: string;
  risk_classification: string;
  description: string | null;
  data_usage: unknown;
  human_oversight_required: boolean;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface HrAiModelRunsTable {
  id: string;
  tenant_id: string;
  use_case_id: string;
  model_version: string;
  input_data_snapshot: unknown;
  output_data_snapshot: unknown;
  run_at: Date | null;
  completed_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface HrAiBiasTestsTable {
  id: string;
  tenant_id: string;
  use_case_id: string;
  test_type: string;
  test_data: unknown;
  metrics: unknown;
  threshold: string;
  passed: boolean | null;
  executed_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface HrAiKillSwitchesTable {
  id: string;
  tenant_id: string;
  use_case_id: string;
  triggered_by: string;
  trigger_reason: string;
  triggered_at: Date | null;
  resolved_at: Date | null;
  resolution: string | null;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface Database {
  tenants: TenantsTable;
  audit_log: AuditLogTable;
  idempotency_keys: IdempotencyKeysTable;
  transition_ledgers: TransitionLedgersTable;
  outbox_events: OutboxEventsTable;
  inbox_events: InboxEventsTable;
  platform_notifications: PlatformNotificationsTable;
  scheduler_job_runs: PlatformSchedulerJobRunsTable;
  scheduler_job_schedules: PlatformSchedulerJobSchedulesTable;
  reminder_dispatch_log: ReminderDispatchLogTable;
  effective_dating_activation_log: EffectiveDatingActivationLogTable;
  approval_chains: ApprovalChainsTable;
  approval_steps: ApprovalStepsTable;
  approval_delegations: ApprovalDelegationsTable;
  'hr_workflow.approval_chains': ApprovalChainsTable;
  'hr_workflow.approval_steps': ApprovalStepsTable;
  'hr_workflow.approval_delegations': ApprovalDelegationsTable;
  hcm_setup_configs: HcmSetupConfigsTable;
  roles: RolesTable;
  permissions: PermissionsTable;
  user_roles: UserRolesTable;
  users: UsersTable;
  saved_views: SavedViewsTable;
  'hr_platform.saved_views': SavedViewsTable;
  tenant_identity_providers: TenantIdentityProvidersTable;
  sso_auth_transactions: SsoAuthTransactionsTable;
  auth_sessions: AuthSessionsTable;
  auth_tokens: AuthTokensTable;
  service_accounts: ServiceAccountsTable;
  service_account_credentials: ServiceAccountCredentialsTable;
  access_review_campaigns: AccessReviewCampaignsTable;
  access_review_items: AccessReviewItemsTable;
  access_review_workflow_events: AccessReviewWorkflowEventsTable;
  abac_policies: AbacPoliciesTable;
  field_access_policies: FieldAccessPoliciesTable;
  sod_rules: SodRulesTable;
  admin_policy_revisions: AdminPolicyRevisionsTable;
  admin_policy_revision_scopes: AdminPolicyRevisionScopesTable;
  admin_policy_application_runs: AdminPolicyApplicationRunsTable;
  admin_policy_impact_results: AdminPolicyImpactResultsTable;
  admin_policy_decision_evidence: AdminPolicyDecisionEvidenceTable;
  admin_module_operation_records: AdminModuleOperationRecordsTable;
  admin_module_operation_workflows: AdminModuleOperationWorkflowsTable;
  admin_module_operation_controls: AdminModuleOperationControlsTable;
  workers: WorkersTable;
  employment_relationships: EmploymentRelationshipsTable;
  job_assignments: JobAssignmentsTable;
  employment_contracts: EmploymentContractsTable;
  personal_data_records: PersonalDataRecordsTable;
  'hr_position.positions': PositionsTable;
  'hr_position.headcount_requests': HeadcountRequestsTable;
  'hr_org.legal_entities': LegalEntitiesTable;
  'hr_org.org_units': OrgUnitsTable;
  'hr_org.manager_relationships': ManagerRelationshipsTable;
  'hr_recruiting.job_requisitions': JobRequisitionsTable;
  'hr_recruiting.candidates': CandidatesTable;
  'hr_recruiting.interview_plans': InterviewPlansTable;
  'hr_recruiting.offers': OffersTable;
  'hr_onboarding.onboarding_plans': OnboardingPlansTable;
  'hr_onboarding.onboarding_tasks': OnboardingTasksTable;
  'hr_onboarding.onboarding_track_templates': OnboardingTrackTemplatesTable;
  compensation_plans: CompensationPlansTable;
  compensation_bands: CompensationBandsTable;
  compensation_changes: CompensationChangesTable;
  bonus_cycles: BonusCyclesTable;
  equity_grants: EquityGrantsTable;
  variable_comp_plans: VariableCompPlansTable;
  pay_scales: PayScalesTable;
  total_compensation_statements: TotalCompensationStatementsTable;
  benefits_programs: BenefitsProgramsTable;
  benefits_enrollments: BenefitsEnrollmentsTable;
  benefits_life_events: BenefitsLifeEventsTable;
  spending_accounts: SpendingAccountsTable;
  carrier_reconciliation_runs: CarrierReconciliationRunsTable;
  'hr_compliance.policy_documents': PolicyDocumentsTable;
  'hr_compliance.policy_acknowledgements': PolicyAcknowledgementsTable;
  'hr_compliance.legal_holds': LegalHoldsTable;
  'hr_compliance.statutory_reports': StatutoryReportsTable;
  'hr_global_hr.country_rule_sets': CountryRuleSetsTable;
  'hr_global_hr.statutory_leave_types': StatutoryLeaveTypesTable;
  'hr_global_hr.works_council_consultations': WorksCouncilConsultationsTable;
  'hr_global_hr.work_authorization_cases': WorkAuthorizationCasesTable;
  'hr_global_hr.international_assignments': InternationalAssignmentsTable;
  'hr_country_policy.policy_packs': CountryPolicyPacksTable;
  'hr_country_policy.validation_runs': CountryPolicyValidationRunsTable;
  'hr_country_policy.impact_simulations': CountryPolicyImpactSimulationsTable;
  work_schedules: WorkSchedulesTable;
  timesheets: TimesheetsTable;
  time_clock_events: TimeClockEventsTable;
  attendance_exceptions: AttendanceExceptionsTable;
  attendance_daily_ledgers: AttendanceDailyLedgersTable;
  attendance_correction_requests: AttendanceCorrectionRequestsTable;
  overtime_approvals: OvertimeApprovalsTable;
  absence_requests: AbsenceRequestsTable;
  leave_cases: LeaveCasesTable;
  absence_accrual_balances: AbsenceAccrualBalancesTable;
  leave_entitlement_calculations: LeaveEntitlementCalculationsTable;
  payroll_cycles: PayrollCyclesTable;
  payroll_inputs: PayrollInputsTable;
  payroll_calculation_runs: PayrollCalculationRunsTable;
  payroll_result_lines: PayrollResultLinesTable;
  payroll_payment_batches: PayrollPaymentBatchesTable;
  payroll_payslip_artifacts: PayrollPayslipArtifactsTable;
  payroll_export_jobs: PayrollExportJobsTable;
  payroll_gl_postings: PayrollGlPostingsTable;

  shift_schedules: ShiftSchedulesTable;
  open_shifts: OpenShiftsTable;
  shift_bids: ShiftBidsTable;
  shift_swap_requests: ShiftSwapRequestsTable;
  wfm_overtime_approvals: WfmOvertimeApprovalsTable;
  coverage_gaps: CoverageGapsTable;
  employee_relations_cases: EmployeeRelationsCasesTable;
  er_investigations: ErInvestigationsTable;
  disciplinary_actions: DisciplinaryActionsTable;
  accommodation_cases: AccommodationCasesTable;
  hr_service_cases: HrServiceCasesTable;
  hr_case_tasks: HrCaseTasksTable;
  hr_knowledge_articles: HrKnowledgeArticlesTable;
  hr_service_catalog_items: HrServiceCatalogItemsTable;
  hr_case_sla_instances: HrCaseSlaInstancesTable;
  contingent_worker_assignments: ContingentWorkerAssignmentsTable;
  sow_engagements: SowEngagementsTable;
  contractor_rate_cards: ContractorRateCardsTable;
  misclassification_assessments: MisclassificationAssessmentsTable;
  eap_referrals: EapReferralsTable;
  wellness_programs: WellnessProgramsTable;
  mental_health_cases: MentalHealthCasesTable;
  union_recognitions: UnionRecognitionsTable;
  grievances: GrievancesTable;
  collective_bargaining_sessions: CollectiveBargainingSessionsTable;
  'hr_reporting.report_definitions': ReportDefinitionsTable;
  'hr_reporting.report_executions': ReportExecutionsTable;
  'hr_reporting.report_schedules': ReportSchedulesTable;
  'hr_reporting.calculated_fields': CalculatedFieldsTable;
  'hr_dei_analytics.dei_reports': DeiReportsTable;
  'hr_dei_analytics.pay_gap_reports': PayGapReportsTable;
  'hr_dei_analytics.pay_equity_reviews': PayEquityReviewsTable;
  'hr_dei_analytics.attrition_segment_reports': AttritionSegmentReportsTable;
  'hr_intelligence.attrition_risk_snapshots': AttritionRiskSnapshotsTable;
  'hr_intelligence.attendance_payroll_anomaly_snapshots': AttendancePayrollAnomalySnapshotsTable;
  'hr_ai.hr_ai_use_cases': HrAiUseCasesTable;
  'hr_ai.hr_ai_model_runs': HrAiModelRunsTable;
  'hr_ai.hr_ai_bias_tests': HrAiBiasTestsTable;
  'hr_ai.hr_ai_kill_switches': HrAiKillSwitchesTable;
  learning_courses: GeneratedWorkflowTable;
  learning_content_packages: GeneratedWorkflowTable;
  learning_assignments: GeneratedWorkflowTable;
  certifications: GeneratedWorkflowTable;
  engagement_surveys: GeneratedWorkflowTable;
  survey_responses: GeneratedWorkflowTable;
  feedback_360_cycles: GeneratedWorkflowTable;
  recognition_programs: GeneratedWorkflowTable;
  recognition_records: GeneratedWorkflowTable;
  skill_profiles: GeneratedWorkflowTable;
  talent_pools: GeneratedWorkflowTable;
  career_paths: GeneratedWorkflowTable;
  succession_plans: GeneratedWorkflowTable;
  review_templates: GeneratedWorkflowTable;
  performance_reviews: GeneratedWorkflowTable;
  performance_review_cycles: GeneratedWorkflowTable;
  performance_improvement_plans: GeneratedWorkflowTable;
  development_plans: GeneratedWorkflowTable;
  objectives: GeneratedWorkflowTable;
  competencies: GeneratedWorkflowTable;
  kpis: GeneratedWorkflowTable;
  kpi_measurements: GeneratedWorkflowTable;
  calibration_sessions: GeneratedWorkflowTable;
  key_results: GeneratedWorkflowTable;
  goals: GeneratedWorkflowTable;
  performance_feedback_360_responses: GeneratedWorkflowTable;
  performance_feedback_360_cycles: GeneratedWorkflowTable;
  'hr_scheduler.scheduler_jobs': SchedulerJobsTable;
  'hr_scheduler.scheduler_job_runs': SchedulerJobRunsTable;
}
