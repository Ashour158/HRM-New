# Enterprise HR/HCM Platform — Full Feature Depth Chart

**Derived from:** Master Blueprint v1.4 (enterprise_hr_hcm_master_blueprint_v1_4_country_policy_approval_ready.md)  
**Generated:** 2026-05-23  
**Scope:** Comprehensive catalog of all features, services, FSMs, tables, policy engines, commands, and events across V1.0 → V1.4  
**Methodology:** Authority-first, owner-only mutation, canonical aggregate tracking  

---

## Table of Contents

1. [Module Hierarchy Overview](#1-module-hierarchy-overview)
2. [Feature Depth Charts by Module](#2-feature-depth-charts-by-module)
   - 2.1 [HR Platform Foundation](#21-hr-platform-foundation)
   - 2.2 [Core HR & Organization](#22-core-hr--organization)
   - 2.3 [Talent Acquisition & Onboarding](#23-talent-acquisition--onboarding)
   - 2.4 [Employment Lifecycle & Service Delivery](#24-employment-lifecycle--service-delivery)
   - 2.5 [Time, Attendance, Payroll & Benefits](#25-time-attendance-payroll--benefits)
   - 2.6 [Talent, Learning, Performance & Engagement](#26-talent-learning-performance--engagement)
   - 2.7 [Employee Relations, Compliance & HR Service Delivery](#27-employee-relations-compliance--hr-service-delivery)
   - 2.8 [Global HR, Localization & Country Policy Governance](#28-global-hr-localization--country-policy-governance)
   - 2.9 [Workforce Management & Scheduling](#29-workforce-management--scheduling)
   - 2.10 [DEI, People Analytics & Reporting](#210-dei-people-analytics--reporting)
   - 2.11 [HR Mobile Platform](#211-hr-mobile-platform)
   - 2.12 [Wellbeing, EAP & Financial Wellness](#212-wellbeing-eap--financial-wellness)
   - 2.13 [Union & Labor Relations](#213-union--labor-relations)
   - 2.14 [HR AI Governance](#214-hr-ai-governance)
3. [Mermaid Feature Hierarchy Diagram](#3-mermaid-feature-hierarchy-diagram)
4. [Summary Statistics](#4-summary-statistics)
5. [Version Distribution Matrix](#5-version-distribution-matrix)
6. [Cross-Reference Indices](#6-cross-reference-indices)
   - 6.1 [FSM Index](#61-fsm-index)
   - 6.2 [Table Index](#62-table-index)
   - 6.3 [Policy Engine Index](#63-policy-engine-index)

---

## 1. Module Hierarchy Overview

```text
Enterprise HR/HCM Platform (V1.4)
|
+-- 2.1 HR Platform Foundation
|   +-- HR Tenant Policy, Data Privacy, Document Platform, Approval Management,
|   +-- Audit Ledger, Workflow Engine, Universal Command Contract, Guard Library
|
+-- 2.2 Core HR & Organization
|   +-- Worker Profile, Personal Data, Employment Relationship, Legal Entity,
|   +-- Org Unit, Position Control, Job Architecture, Manager Relationship
|
+-- 2.3 Talent Acquisition & Onboarding
|   +-- Workforce Planning, Headcount Request, Job Requisition, Candidate Management,
|   +-- Interview Plan, Assessment, Background Check, Offer, Onboarding
|
+-- 2.4 Employment Lifecycle & Service Delivery
|   +-- Employment Contract, Job Assignment, Transfer/Promotion/Demotion,
|   +-- Probation, Offboarding/Termination, HR Case, ER Case,
|   +-- Disciplinary Action, Accommodation Case
|
+-- 2.5 Time, Attendance, Payroll & Benefits
|   +-- Work Schedule, Time Clock, Timesheet, Attendance Exception,
|   +-- Absence Request, Leave Case, Accrual Balance, Payroll Input,
|   +-- Payroll Cycle, Payslip, Benefits Program, Benefits Enrollment
|
+-- 2.6 Talent, Learning, Performance & Engagement
|   +-- Goals/OKR, Performance Review, Calibration, PIP, Continuous Feedback,
|   +-- Learning Course, Learning Assignment, Skill Profile, Certification,
|   +-- Career Path, Talent Pool, Succession Plan, Engagement Survey, Recognition
|
+-- 2.7 Employee Relations, Compliance & HR Service Delivery
|   +-- HR Service Case, ER Case, Investigation, Disciplinary, Accommodation,
|   +-- Policy Acknowledgement, Statutory Report, Work Authorization, Legal Hold,
|   +-- HR Knowledge, HR Service Catalog, Virtual Agent, Case SLA
|
+-- 2.8 Global HR, Localization & Country Policy Governance
|   +-- Country Labor Rule Set, Country Policy Pack, Statutory Leave Type,
|   +-- Works Council, Work Authorization, Statutory Report, Tax Filing
|
+-- 2.9 Workforce Management & Scheduling
|   +-- Shift Schedule, Open Shift, Shift Bid, Shift Swap, Overtime,
|   +-- Coverage Gap, Schedule Adherence
|
+-- 2.10 DEI, People Analytics & Reporting
|   +-- DEI Report, Pay Gap Report, Pay Equity Audit, Promotion Equity,
|   +-- Attrition Analytics, Ad-Hoc Reporting, Report Builder, Workforce Planning
|
+-- 2.11 HR Mobile Platform
|   +-- Device Registration, Offline Package, Sync Batch, Mobile Clock,
|   +-- Mobile Approval, Push Token, Geofence
|
+-- 2.12 Wellbeing, EAP & Financial Wellness
|   +-- EAP Referral, Wellness Program, Wellness Claim, Financial Wellness
|
+-- 2.13 Union & Labor Relations
|   +-- Union Contract/CBA, Union Membership, Union Grievance,
|   +-- Labor Action, Steward Assignment, Works Council
|
+-- 2.14 HR AI Governance
    +-- AI Use Case Registry, Model Run Tracking, Bias Testing,
    +-- Human Review, Kill Switch, Safety Findings
```

---

## 2. Feature Depth Charts by Module

### Legend

| Column | Meaning |
|--------|---------|
| **Feature** | Canonical feature/service name |
| **Description** | Purpose and scope summary |
| **Version** | Version introduced: V1.0 / V1.1 / V1.2 / V1.4 |
| **Authority Owner** | Domain that owns authoritative mutation |
| **Canonical Tables** | Primary aggregate tables used |
| **FSM** | Finite state machine(s) governing lifecycle |
| **Commands** | Authoritative commands available |
| **Events Published** | Domain events emitted |
| **Policy Engines** | Associated decision engines |
| **Projections** | Read model projections available |

---

### 2.1 HR Platform Foundation

**Foundation services that enable all other HR modules.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **HR Tenant Policy** | HR-specific tenant settings, country scope, legal entity config, localization, labor-law scope | V1.0 | HR Tenant Policy | `hr_tenant_policies` | — | ConfigureHrTenant, SetTenantCountryScope, SetLegalEntityConfig | HrTenantConfigured, CountryScopeSet, LegalEntityConfigSet | Employment Eligibility | TenantConfigProjection |
| **HR Data Privacy** | PII governance, special-category data protection, employee/manager visibility rules, field-level privacy | V1.0 | HR Data Privacy | `hr_personal_data_records`, `hr_data_subject_requests` | PolicyAcknowledgement (6.26) | UpdatePrivacyPolicy, SetFieldVisibility, RedactPersonalData, ProcessDataSubjectRequest | PrivacyPolicyUpdated, FieldVisibilitySet, PersonalDataRedacted, DsarReceived | HR Privacy & Visibility (7.10) | PrivacyConfigProjection, FieldPolicyProjection |
| **HR Document Platform** | Templates, employee files, e-signatures, document classification, retention schedules | V1.0 | HR Document Platform | `hr_worker_documents`, `hr_document_templates` | — | UploadDocument, ClassifyDocument, SetRetentionSchedule, RequestSignature, RecordSignature | DocumentUploaded, DocumentClassified, SignatureRequested, SignatureRecorded | Employment Eligibility (7.1) | DocumentInventoryProjection |
| **HR Approval Management** | Approval routes, decision chains, SoD validation, approval freshness validation | V1.0 | HR Approval Management | `hr_approval_routes`, `approval_decisions` | — | CreateApprovalRoute, SubmitForApproval, RecordApprovalDecision, EscalateApproval, RevokeApproval | ApprovalRouteCreated, ApprovalSubmitted, ApprovalDecisionRecorded, ApprovalEscalated | Position & Headcount (7.2), Compensation | ApprovalRouteProjection, PendingApprovalProjection |
| **HR Audit Ledger** | Authoritative audit trail for all employee-data access, payroll changes, compensation changes, ER evidence | V1.0 | HR Audit Ledger | `hr_audit_access_logs` | — | RecordAuditEntry, ExportAuditTrail, SetLegalHold, ReleaseLegalHold | AuditEntryRecorded, LegalHoldSet, LegalHoldReleased | HR Privacy & Visibility (7.10) | AuditTrailProjection |
| **HR Workflow Engine** | FSM validation, transition ledger, guard evaluation, state machine orchestration | V1.0 | HR Workflow Engine (platform) | `workflow_instances`, `transition_ledgers` | Universal guard library (6.1) | ValidateTransition, RecordTransition, RegisterFsmDefinition | TransitionValidated, TransitionRecorded, FsmRegistered | All | WorkflowInstanceProjection |
| **Universal Command Contract** | Standardized command envelope, idempotency, outbox/inbox, replay discipline | V1.0 | HR Platform Foundation | `hr_command_outbox`, `hr_command_inbox` | — | ProcessCommand, ValidateIdempotency, StoreOutboxEvent | CommandProcessed, IdempotencyValidated, OutboxStored | — | CommandHistoryProjection |

**Foundation Module Statistics:** 7 features, 1 FSM (PolicyAcknowledgement reused), 7 policy engine integrations

---

### 2.2 Core HR & Organization

**The heart of the HR system — worker identity, employment truth, and organizational structure.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **Worker Profile** | Worker identity, employment lifecycle, status management — the aggregate root of HR | V1.0 | HR Core | `hr_workers` | WorkerProfile (6.2): 9 states | CreateWorkerProfile, ActivateWorker, UpdateWorkerPersonalData, SuspendWorker, TerminateWorker, ArchiveWorker | WorkerProfileCreated, WorkerActivated, WorkerPersonalDataUpdated, WorkerSuspended, WorkerTerminated, WorkerArchived | Employment Eligibility (7.1), HR Privacy (7.10) | WorkerDirectoryProjection, WorkerTimelineProjection |
| **Personal Data** | Demographics, addresses, emergency contacts, national IDs, work authorization — privacy-governed | V1.0 | HR Core / Privacy | `hr_personal_data_records` | — | UpdateLegalName, UpdateAddress, UpdateEmergencyContact, UpdateNationalIdentifier, RedactPersonalData | LegalNameUpdated, WorkerAddressUpdated, EmergencyContactUpdated, NationalIdentifierUpdated, PersonalDataRedacted | HR Privacy & Visibility (7.10), Employment Eligibility (7.1) | PersonalDataProjection (field-filtered) |
| **Employment Relationship** | Employment type lifecycle (employee, contractor, intern, consultant, temporary) | V1.0 | HR Core | `hr_employment_relationships` | WorkerProfile (6.2) | StartEmployment, ChangeEmploymentType, PlaceWorkerOnLeave, EndEmployment | EmploymentStarted, EmploymentTypeChanged, WorkerPlacedOnLeave, EmploymentEnded | Employment Eligibility (7.1), Position & Headcount (7.2) | EmploymentHistoryProjection |
| **Legal Entity** | Employer-of-record, country, statutory registration | V1.0 | Organization Management | `org_legal_entities` | — | CreateLegalEntity, UpdateLegalEntity, ArchiveLegalEntity | LegalEntityCreated, LegalEntityUpdated, LegalEntityArchived | Global Labor-Law (7.13), Employment Eligibility (7.1) | LegalEntityProjection |
| **Organization Unit** | Business unit, division, department, team hierarchy | V1.0 | Organization Management | `org_units` | — | CreateOrgUnit, ReorganizeOrgUnit, MergeOrgUnit, ArchiveOrgUnit | OrgUnitCreated, OrgUnitReorganized, OrgUnitMerged, OrgUnitArchived | Organization Design (7.29) | OrgChartProjection |
| **Position Control** | Approved positions, headcount, budgeted roles — the hiring authority | V1.0 | Position Management | `org_positions` | Position (6.3): 8 states | CreatePosition, ApprovePosition, OpenPosition, FreezePosition, FillPosition, ClosePosition, ArchivePosition | PositionCreated, PositionApproved, PositionOpened, PositionFrozen, PositionFilled, PositionClosed | Position & Headcount (7.2) | PositionInventoryProjection, HeadcountProjection |
| **Job Architecture** | Job families, job profiles, grades, levels, competencies | V1.0 | Job Architecture | `job_profiles`, `job_families`, `job_grades` | — | CreateJobProfile, PublishJobProfile, RetireJobProfile | JobProfileCreated, JobProfilePublished, JobProfileRetired | Position & Headcount (7.2), Compensation | JobArchitectureProjection |
| **Manager Relationship** | Effective-dated reporting relationships and reporting chains | V1.0 | Organization Management | `org_manager_relationships` | — | AssignManager, UpdateReportingChain, EndManagerRelationship | ManagerAssigned, ReportingChainUpdated, ManagerRelationshipEnded | — | ReportingChainProjection, SpanLayerProjection |
| **Compensation Band** | Pay ranges by grade, job, geography, effective date | V1.0 | Compensation | `compensation_bands` | CompensationBandMarket (6.33): 6 states | PublishCompensationBand, RetireCompensationBand, ImportMarketSurvey, ApproveMarketPositioning | CompensationBandPublished, CompensationBandRetired, MarketSurveyImported, MarketPositioningApproved | Compensation/Equity/Total Rewards (7.11) | CompensationBandProjection |
| **Probation Review** | Probation periods, check-ins, pass/extend/fail decisions | V1.1 | HR Core / Performance | `hr_probation_records` | — | StartProbationReview, RecordProbationCheckIn, PassProbation, ExtendProbation, FailProbation, CloseProbationReview | ProbationReviewStarted, ProbationCheckInRecorded, ProbationPassed, ProbationExtended, ProbationFailed | Performance & Calibration (7.7) | ProbationStatusProjection |

**Core HR & Organization Statistics:** 10 features, 2 FSMs (WorkerProfile, Position), 12+ tables, 8 policy engine integrations

---

### 2.3 Talent Acquisition & Onboarding

**Hire-to-ready: from workforce planning through new-hire onboarding.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **Workforce Planning** | Strategic headcount scenarios, demand/supply matching, FTE budget reconciliation | V1.0 | Workforce Planning | `workforce_plans`, `workforce_scenarios`, `workforce_demand_lines` | WorkforcePlan (3.1): 4 states | DraftWorkforcePlan, ApproveWorkforcePlan, ActivateWorkforcePlan, SupersedeWorkforcePlan | WorkforcePlanDrafted, WorkforcePlanApproved, WorkforcePlanActivated, WorkforcePlanSuperseded | Workforce Planning (7.17) | WorkforcePlanProjection, HeadcountDashboard |
| **Headcount Request** | Hiring demand creation, approval workflow before recruiting begins | V1.0 | Position Control | `headcount_requests` | HeadcountRequest (6.4): 8 states | RequestHeadcount, ReviewHeadcount, ApproveHeadcount, RejectHeadcount, FulfillHeadcount | HeadcountRequested, HeadcountApproved, HeadcountRejected, HeadcountFulfilled | Position & Headcount (7.2) | HeadcountRequestProjection |
| **Job Requisition** | Hiring request lifecycle — from draft through filled | V1.0 | Recruiting | `job_requisitions`, `requisition_postings` | JobRequisition (6.5): 13 states | CreateJobRequisition, SubmitRequisitionApproval, ApproveRequisition, PostRequisition, PutRequisitionOnHold, CloseRequisition, CancelRequisition | JobRequisitionCreated, JobRequisitionApproved, JobRequisitionPosted, JobRequisitionClosed, JobRequisitionCancelled | Recruiting Fairness (7.3), Position & Headcount (7.2) | RequisitionPipelineProjection |
| **Candidate Profile** | Candidate identity, PII, consent, profile management | V1.0 | Recruiting | `candidates`, `candidate_consents` | — | CreateCandidate, RecordCandidateConsent, UpdateCandidateProfile, MergeCandidate, ArchiveCandidate | CandidateCreated, CandidateConsentRecorded, CandidateUpdated, CandidateMerged, CandidateArchived | Recruiting Fairness (7.3), HR Privacy (7.10) | CandidatePoolProjection |
| **Candidate Application** | Job-specific application lifecycle tracking | V1.0 | Recruiting | `candidate_applications` | CandidateApplication (6.6): 11 states | SubmitApplication, ScreenApplication, AdvanceApplication, RejectApplication, WithdrawApplication, MoveToTalentPool | CandidateApplicationSubmitted, CandidateScreened, CandidateAdvanced, CandidateRejected, CandidateWithdrawn | Recruiting Fairness (7.3) | ApplicationPipelineProjection |
| **Interview Plan** | Interview stages, scorecards, scheduling, feedback collection | V1.0 | Recruiting | `interview_plans`, `interview_events` | Interview Plan (3.1): 5 states | CreateInterviewPlan, ScheduleInterview, SubmitInterviewFeedback, CompleteInterviewStage, CancelInterview | InterviewPlanCreated, InterviewScheduled, InterviewFeedbackSubmitted, InterviewStageCompleted | Recruiting Fairness (7.3) | InterviewScheduleProjection |
| **Assessment** | Assessment records and results from integrated providers | V1.0 | Recruiting / Assessment Integration | `assessment_results` | — | RecordAssessmentResult, InvalidateAssessmentResult | AssessmentRecorded, AssessmentInvalidated | Recruiting Fairness (7.3) | AssessmentResultsProjection |
| **Background Check** | External background verification status and decision record | V1.0 | Recruiting / Compliance | `background_check_cases` | — | InitiateBackgroundCheck, RecordBackgroundCheckResult, ReviewBackgroundCheckDecision | BackgroundCheckInitiated, BackgroundCheckResultRecorded | Employment Eligibility (7.1) | BackgroundCheckStatusProjection |
| **Offer Management** | Offer package creation, compensation review, approvals, acceptance | V1.0 | Recruiting | `offers`, `offer_approvals` | Offer (6.7): 10 states | DraftOffer, RequestOfferApproval, ApproveOffer, SendOffer, AcceptOffer, DeclineOffer, WithdrawOffer, ExpireOffer | OfferDrafted, OfferApprovalRequested, OfferApproved, OfferSent, OfferAccepted, OfferDeclined, OfferWithdrawn, OfferExpired | Offer & Compensation (7.4) | OfferPipelineProjection |
| **Onboarding Plan** | New-hire task orchestration, preboarding, first-day readiness | V1.0 | Onboarding | `onboarding_plans`, `onboarding_tasks` | OnboardingPlan (6.8): 9 states | CreateOnboardingPlan, StartPreboarding, CompleteOnboardingTask, BlockOnboarding, CompleteOnboarding, CancelOnboarding | OnboardingPlanCreated, PreboardingStarted, OnboardingTaskCompleted, OnboardingBlocked, OnboardingCompleted | Employment Eligibility (7.1) | OnboardingStatusProjection |
| **Workforce Scenario Planning** | What-if scenarios, FTE budget vs actual, contingent workforce planning | V1.1 | Workforce Planning | `workforce_scenarios`, `workforce_demand_lines`, `workforce_supply_snapshots` | WorkforceScenario (6.63): 7 states | CreateWorkforceScenario, ModelDemandSupply, ApproveWorkforceScenario, ConvertScenarioToHeadcountRequests, ArchiveWorkforceScenario | WorkforceScenarioCreated, DemandSupplyModeled, WorkforceScenarioApproved, ScenarioConvertedToHeadcountRequests | Workforce Planning (7.17) | WorkforceScenarioProjection |
| **Skills Gap Analysis** | Aggregated skills gap with recommended learning/recruiting actions | V1.1 | Workforce Planning / Learning | `skills_gap_analyses` | SkillsGapAnalysis (6.64): 8 states | StartSkillsGapAnalysis, PublishSkillsGapAnalysis, RequestLearningPlanFromGap, ArchiveSkillsGapAnalysis | SkillsGapAnalysisStarted, SkillsGapAnalysisPublished, LearningPlanRequestedFromGap | Workforce Planning (7.17) | SkillsGapProjection |
| **Career Site Platform** | Career site CMS, job posts, SEO, source tracking | V1.2 | Recruiting / Candidate Experience | `career_site_pages`, `career_site_job_posts` | CareerSitePage (3.9): 3 states | DraftCareerSitePage, PublishCareerSitePage, RetireCareerSitePage | CareerSitePageDrafted, CareerSitePagePublished, CareerSitePageRetired | Candidate Experience (7.27) | CareerSiteProjection |
| **Interview Self-Scheduling** | Candidate-driven interview slot selection | V1.2 | Recruiting / Candidate Experience | `interview_self_schedule_slots` | Interview Self-Schedule (3.9): 4 states | PublishInterviewSlots, ReserveInterviewSlot, ConfirmInterviewSlot, CancelInterviewSlot | InterviewSlotsPublished, InterviewSlotReserved, InterviewSlotConfirmed, InterviewSlotCancelled | Candidate Experience (7.27) | SelfScheduleProjection |
| **Candidate Referral** | Employee referral lifecycle and reward eligibility | V1.2 | Recruiting / Candidate Experience | `candidate_referrals` | — | SubmitCandidateReferral, ValidateCandidateReferral, ApproveReferralReward, RejectCandidateReferral | CandidateReferralSubmitted, CandidateReferralValidated, ReferralRewardApproved, CandidateReferralRejected | Candidate Experience (7.27) | ReferralPipelineProjection |
| **Video Interview** | Async/sync video interview session evidence | V1.2 | Candidate Experience | `video_interview_sessions` | — | RecordVideoInterviewSession, StoreInterviewRecording | VideoInterviewRecorded | Recruiting Fairness (7.3) | VideoInterviewProjection |
| **I-9 / Employment Eligibility** | I-9 case lifecycle, document review, E-Verify, reverification | V1.2 | Employment Eligibility | `i9_cases`, `i9_document_reviews`, `everify_cases` | I9Case (6.84): 11 states | CreateI9Case, CompleteI9Section1, CompleteI9Section2, RecordI9DocumentReview, CorrectI9Case, ReverifyI9, CloseI9Case | I9CaseCreated, I9Section1Completed, I9Section2Completed, I9DocumentReviewRecorded, I9CaseCorrected, I9Reverified | Employment Eligibility (7.1), Candidate Experience (7.27) | I9StatusProjection |
| **E-Verify Integration** | E-Verify case lifecycle and government result processing | V1.2 | Employment Eligibility | `everify_cases` | — | SubmitEVerifyCase, RecordEVerifyResult, ContestEVerifyTentativeNonconfirmation, CloseEVerifyCase | EVerifyCaseSubmitted, EVerifyResultRecorded, EVerifyTentativeNonconfirmationContested, EVerifyCaseClosed | Employment Eligibility (7.1) | EVerifyStatusProjection |
| **Candidate Communications** | Candidate messaging, templates, response tracking | V1.2 | Candidate Experience | `candidate_communications` | — | SendCandidateCommunication, RecordCandidateResponse | CandidateCommunicationSent, CandidateResponseRecorded | Candidate Experience (7.27) | CommunicationLogProjection |

**Talent Acquisition & Onboarding Statistics:** 19 features, 7 FSMs, 18+ tables, 9 policy engine integrations

---

### 2.4 Employment Lifecycle & Service Delivery

**Job assignments, compensation changes, transfers, offboarding, and all HR case management.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **Employment Contract** | Contract lifecycle, amendments, e-signatures, legal review | V1.0 | HR Core / Legal HR | `hr_employment_contracts` | EmploymentContract (6.9): 11 states | DraftEmploymentContract, RequestContractApproval, SendContractForSignature, RecordContractSigned, AmendEmploymentContract, TerminateEmploymentContract | EmploymentContractDrafted, EmploymentContractApprovalRequested, EmploymentContractSentForSignature, EmploymentContractSigned, EmploymentContractAmended | Employment Eligibility (7.1) | ContractStatusProjection |
| **Job Assignment** | Effective-dated role, position, location, manager, FTE, employment status | V1.0 | HR Core | `hr_job_assignments` | JobAssignment (6.10): 8 states | ProposeJobAssignment, ApproveJobAssignment, ActivateJobAssignment, EndJobAssignment, CorrectJobAssignment | JobAssignmentProposed, JobAssignmentApproved, JobAssignmentActivated, JobAssignmentEnded, JobAssignmentCorrected | Employment Eligibility (7.1), Position & Headcount (7.2) | JobAssignmentProjection |
| **Transfer / Promotion / Demotion** | Change request lifecycle; updates job assignment through HR commands only | V1.0 | HR Core | `hr_job_assignments` (with change reason) | JobAssignment (6.10) | ProposeTransfer, RequestTransferApproval, ApproveTransfer, ExecuteTransfer | TransferProposed, TransferApproved, TransferExecuted | Employment Eligibility (7.1), Position & Headcount (7.2), Compensation | TransferPipelineProjection |
| **Compensation Change** | Pay change proposals, reviews, approvals, effective dating | V1.0 | Compensation | `compensation_changes` | CompensationChange (6.15): 10 states | ProposeCompensationChange, ReviewCompensationChange, ApproveCompensationChange, ApplyCompensationChange, RejectCompensationChange | CompensationChangeProposed, CompensationChangeReviewed, CompensationChangeApproved, CompensationChangeApplied, CompensationChangeRejected | Compensation/Equity/Total Rewards (7.11) | CompensationChangePipelineProjection |
| **Offboarding Plan** | Termination orchestration with cross-domain task coordination | V1.1 | Offboarding / HR Core | `offboarding_plans`, `offboarding_tasks` | OffboardingPlan (6.34): 14 states | CreateOffboardingPlan, StartOffboardingPlan, AddOffboardingTask, CompleteOffboardingTask, BlockOffboardingPlan, CompleteOffboardingPlan, ArchiveOffboardingPlan | OffboardingPlanCreated, OffboardingPlanStarted, OffboardingTaskAdded, OffboardingTaskCompleted, OffboardingPlanBlocked, OffboardingPlanCompleted | Offboarding & Alumni, Employment Eligibility (7.1) | OffboardingStatusProjection |
| **Exit Interview** | Exit interview scheduling, completion, redaction, archival | V1.1 | Offboarding / Employee Experience | `exit_interviews` | ExitInterview (6.35): 7 states | ScheduleExitInterview, CompleteExitInterview, DeclineExitInterview, RedactExitInterview, ArchiveExitInterview | ExitInterviewScheduled, ExitInterviewCompleted, ExitInterviewDeclined, ExitInterviewRedacted | HR Privacy (7.10) | ExitInterviewProjection |
| **Final Settlement** | Final pay calculation, PTO payout, deductions, continuation options | V1.1 | Payroll / Offboarding | `final_settlements` | FinalSettlement (6.36): 10 states | CalculateFinalSettlement, ReviewFinalSettlement, ApproveFinalSettlement, StageFinalSettlementForPayroll, MarkFinalSettlementPaid | FinalSettlementCalculated, FinalSettlementApproved, FinalSettlementStagedForPayroll, FinalSettlementPaid | Payroll Validation (7.6), Compensation | FinalSettlementProjection |
| **Reference Request** | Reference authorization, content constraints, approval, delivery | V1.1 | HR Core / Offboarding | `reference_requests` | ReferenceRequest (6.37): 9 states | RequestReference, ApproveReferenceResponse, RejectReferenceRequest, DeliverReferenceResponse, ArchiveReferenceRequest | ReferenceRequested, ReferenceResponseApproved, ReferenceRequestRejected, ReferenceResponseDelivered | HR Privacy (7.10) | ReferenceRequestProjection |
| **Alumni Portal** | Post-employment access scope and lifecycle management | V1.1 | Alumni Portal | `alumni_portal_accounts` | AlumniPortalAccount (6.38): 6 states | InviteAlumni, ActivateAlumniAccess, LimitAlumniAccess, SuspendAlumniAccount, DeactivateAlumni | AlumniInvited, AlumniActivated, AlumniLimited, AlumniSuspended | HR Privacy (7.10) | AlumniDirectoryProjection |
| **HR Service Case** | Employee questions, requests, policy support, service task routing | V1.1 | HR Service Delivery | `hr_service_cases`, `hr_case_tasks` | HRServiceCase (6.22): 13 states | OpenHrCase, ClassifyHrCase, AssignHrCase, AddHrCaseTask, ResolveHrCase, CloseHrCase, ReopenHrCase | HrCaseOpened, HrCaseClassified, HrCaseAssigned, HrCaseTaskAdded, HrCaseResolved, HrCaseClosed, HrCaseReopened | HR Service Delivery (7.15) | HRServiceCaseProjection |
| **Employee Life Event** | Marriage, birth/adoption, address change, relocation, dependent changes | V1.1 | Employee Self-Service / Benefits | `employee_life_events` | EmployeeLifeEvent (6.61): 11 states | StartLifeEvent, SubmitLifeEventEvidence, ApproveLifeEvent, RejectLifeEvent, ApplyLifeEventEffects, CloseLifeEvent | LifeEventStarted, LifeEventEvidenceSubmitted, LifeEventApproved, LifeEventRejected, LifeEventEffectsApplied | Benefits (7.14), Employment Eligibility (7.1) | LifeEventProjection |
| **Manager Action Request** | Manager-initiated HR actions with approval and execution state | V1.1 | Manager Self-Service / HR Core | `manager_action_requests` | ManagerActionRequest (6.62): 10 states | SubmitManagerActionRequest, ApproveManagerActionRequest, RejectManagerActionRequest, ExecuteManagerActionRequest, CancelManagerActionRequest | ManagerActionRequested, ManagerActionApproved, ManagerActionRejected, ManagerActionExecuted | Self-Service Authority (7.16) | ManagerActionProjection |

**Employment Lifecycle & Service Delivery Statistics:** 12 features, 9 FSMs, 12+ tables, 10 policy engine integrations

---

### 2.5 Time, Attendance, Payroll & Benefits

**The operational core — tracking time, processing payroll, and managing benefits.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **Work Schedule** | Work patterns, shift templates, calendars | V1.0 | Time and Attendance | `work_schedules` | — | CreateWorkSchedule, PublishWorkSchedule, UpdateWorkSchedule | WorkScheduleCreated, WorkSchedulePublished | Time & Absence (7.5) | WorkScheduleProjection |
| **Time Clock** | Raw punches, normalized time facts, clock-in/out events | V1.0 | Time and Attendance | `time_clock_events` | — | RecordClockEvent, NormalizeClockEvent, ImportClockEvents | ClockEventRecorded, ClockEventNormalized | Time & Absence (7.5) | TimeClockProjection |
| **Timesheet** | Timesheet submission, approval, export to payroll | V1.0 | Time and Attendance | `timesheets`, `timesheet_entries` | Timesheet (6.13): 9 states | OpenTimesheet, SubmitTimesheet, ApproveTimesheet, RejectTimesheet, LockTimesheet, ExportTimesheetToPayroll, ReopenTimesheet | TimesheetOpened, TimesheetSubmitted, TimesheetApproved, TimesheetRejected, TimesheetLocked, TimesheetExportedToPayroll | Time & Absence (7.5), Payroll Validation (7.6) | TimesheetStatusProjection |
| **Attendance Exception** | Missing punch, late arrival, absence exception detection and resolution | V1.0 | Time and Attendance | `attendance_exceptions` | — | DetectAttendanceException, RequestEmployeeResponse, ApproveAttendanceAdjustment, CloseAttendanceException | AttendanceExceptionDetected, AttendanceEmployeeResponseRequested, AttendanceAdjustmentApproved | Time & Absence (7.5) | AttendanceExceptionProjection |
| **Absence Request** | Time-off request and approval workflow | V1.0 | Absence Management | `absence_requests` | AbsenceRequest (6.11): 9 states | RequestAbsence, ApproveAbsence, RejectAbsence, CancelAbsence, AdjustAbsence | AbsenceRequested, AbsenceApproved, AbsenceRejected, AbsenceCancelled, AbsenceAdjusted | Time & Absence (7.5) | AbsenceRequestProjection |
| **Leave Case** | Long leave, medical leave, statutory leave, return-to-work | V1.0 | Leave Management | `leave_cases` | LeaveCase (6.12): 13 states | OpenLeaveCase, RequestLeaveDocumentation, ApproveLeave, StartLeave, ExtendLeave, ReturnFromLeave, CloseLeaveCase | LeaveCaseOpened, LeaveDocumentationRequested, LeaveApproved, LeaveStarted, LeaveExtended, WorkerReturnedFromLeave | Time & Absence (7.5), Absence Entitlement (7.23) | LeaveCaseProjection |
| **Accrual Balance** | Earned, used, adjusted leave balances | V1.0 | Absence Management | `absence_accrual_balances` | — | CalculateAccrual, RecordAccrualUsage, AdjustAccrualBalance | AccrualCalculated, AccrualUsageRecorded, AccrualAdjusted | Absence Entitlement (7.23) | AccrualBalanceProjection |
| **Payroll Input** | Earnings, deductions, tax inputs, one-time payments staging | V1.0 | Payroll | `payroll_inputs` | — | StagePayrollInput, ValidatePayrollInput, ApprovePayrollAdjustment, SupersedePayrollInput | PayrollInputStaged, PayrollInputValidated, PayrollAdjustmentApproved, PayrollInputSuperseded | Payroll Validation (7.6) | PayrollInputProjection |
| **Payroll Cycle** | Data collection, validation, lock, export, correction | V1.0 | Payroll | `payroll_cycles`, `payroll_validation_results`, `payroll_export_batches` | PayrollCycle (6.14): 13 states | OpenPayrollCycle, CollectPayrollInputs, ValidatePayroll, ApprovePayroll, LockPayroll, ExportPayroll, RecordPayrollPaid, ClosePayrollCycle, ReopenPayrollForCorrection | PayrollCycleOpened, PayrollInputsCollected, PayrollValidated, PayrollApproved, PayrollLocked, PayrollExported, PayrollPaid, PayrollCycleClosed | Payroll Validation (7.6) | PayrollCycleStatusProjection |
| **Payslip** | Pay-result references and access policy | V1.0 | Payroll | `payslip_metadata`, `payslip_access_logs` | — | GeneratePayslip, PublishPayslip, RevokePayslipAccess | PayslipGenerated, PayslipPublished, PayslipAccessRevoked | HR Privacy (7.10), Payroll Validation (7.6) | PayslipProjection (field-filtered) |
| **Benefits Program** | Plan definitions, eligibility rules, coverage configuration | V1.0 | Benefits | `benefits_programs` | — | CreateBenefitsProgram, PublishBenefitsProgram, UpdateEligibilityRules, RetireBenefitsProgram | BenefitsProgramCreated, BenefitsProgramPublished, BenefitsProgramRetired | Benefits (7.14) | BenefitsProgramProjection |
| **Benefits Enrollment** | Enrollment lifecycle, changes, life events, termination | V1.0 | Benefits | `benefits_enrollments`, `benefits_life_events` | BenefitsEnrollment (6.16): 13 states | OpenBenefitsEnrollment, SubmitBenefitsEnrollment, ApproveBenefitsEnrollment, ChangeBenefitsEnrollment, TerminateBenefitsCoverage | BenefitsEnrollmentOpened, BenefitsEnrollmentSubmitted, BenefitsEnrollmentApproved, BenefitsEnrollmentChanged, BenefitsCoverageTerminated | Benefits (7.14) | BenefitsEnrollmentProjection |
| **Payroll Calculation Engine** | Native gross-to-net calculation, retro, explainable result lines | V1.2 | Payroll Calculation | `payroll_calculation_runs`, `payroll_result_lines`, `payroll_rule_sets`, `payroll_retro_calculations` | PayrollCalculationRun (6.77/6.89.1): 11 states | CreatePayrollCalculationRun, StartPayrollCalculation, ApplyPayrollRuleSet, FinalizePayrollCalculation, ReopenPayrollCalculation, VoidPayrollCalculation | PayrollCalculationRunCreated, PayrollCalculationStarted, PayrollRuleSetApplied, PayrollCalculationFinalized, PayrollCalculationReopened, PayrollCalculationVoided | Payroll Calculation (7.21) | PayrollCalculationProjection |
| **Tax Jurisdiction Engine** | Worker tax profile, work/home sourcing, reciprocity, nexus | V1.2 | Payroll Tax | `payroll_tax_jurisdiction_assignments`, `worker_tax_profiles` | TaxJurisdictionAssignment (6.78/6.89.2): 7 states | EvaluateTaxJurisdiction, FinalizeTaxJurisdictionAssignment, SupersedeTaxJurisdictionAssignment | TaxJurisdictionEvaluated, TaxJurisdictionAssignmentFinalized, TaxJurisdictionAssignmentSuperseded | Tax Jurisdiction (7.22) | TaxJurisdictionProjection |
| **Year-End Payroll Reporting** | Payroll tax forms and year-end correction workflow | V1.2 | Payroll Tax / Compliance | `year_end_forms` | — | PrepareYearEndForm, DistributeYearEndForm, CorrectYearEndForm, ArchiveYearEndForm | YearEndFormPrepared, YearEndFormDistributed, YearEndFormCorrected | Payroll Calculation (7.21), Tax Jurisdiction (7.22) | YearEndFormProjection |
| **Tax Filing** | Tax authority filing lifecycle and acknowledgements | V1.2 | Payroll Tax / Compliance | `tax_authority_filings` | — | PreparePayrollTaxFiling, SubmitPayrollTaxFiling, RecordTaxFilingAcknowledgement, AmendPayrollTaxFiling, ClosePayrollTaxFiling | PayrollTaxFilingPrepared, PayrollTaxFilingSubmitted, PayrollTaxFilingAcknowledged, PayrollTaxFilingAmended | Tax Jurisdiction (7.22) | TaxFilingStatusProjection |
| **Benefits Open Enrollment** | Annual/open enrollment window lifecycle | V1.1 | Benefits Management | `benefits_open_enrollments` | BenefitsOpenEnrollment (6.50): 10 states | CreateOpenEnrollment, LaunchOpenEnrollment, SubmitEnrollmentElection, AutoRenewElection, WaiveCoverage, CloseOpenEnrollment | OpenEnrollmentCreated, OpenEnrollmentLaunched, EnrollmentElectionSubmitted, CoverageWaived, OpenEnrollmentClosed | Benefits (7.14) | OpenEnrollmentProjection |
| **Dependent Verification** | Dependent evidence submission and eligibility verification | V1.1 | Benefits Management | `dependent_eligibility_verifications` | DependentEligibilityVerification (6.51): 7 states | RequestDependentVerification, SubmitDependentEvidence, ApproveDependentEligibility, RejectDependentEligibility | DependentVerificationRequested, DependentEvidenceSubmitted, DependentEligibilityApproved | Benefits (7.14) | DependentVerificationProjection |
| **Benefits Continuation** | COBRA/statutory continuation coverage | V1.1 | Benefits Management | `benefits_continuation_cases` | BenefitsContinuationCase (6.52): 10 states | TriggerContinuation, ReviewContinuationEligibility, SendContinuationNotice, RecordContinuationElection | ContinuationTriggered, ContinuationEligibilityReviewed, ContinuationNoticeSent | Benefits (7.14) | ContinuationStatusProjection |
| **Spending Accounts** | FSA/HSA/HRA account lifecycle and limits | V1.1 | Benefits Management | `spending_accounts` | SpendingAccount (6.53): 8 states | CreateSpendingAccount, EnrollInSpendingAccount, ChangeContribution, SuspendSpendingAccount, CloseSpendingAccount | SpendingAccountCreated, SpendingAccountEnrolled, ContributionChanged | Benefits (7.14) | SpendingAccountProjection |
| **Carrier Reconciliation** | Benefits carrier enrollment/billing reconciliation | V1.1 | Benefits Management | `carrier_reconciliation_runs`, `carrier_reconciliation_mismatches` | CarrierReconciliationRun (6.54): 7 states | StartCarrierReconciliation, RecordCarrierMismatch, ResolveCarrierMismatch, CloseCarrierReconciliation | CarrierReconciliationStarted, CarrierMismatchRecorded, CarrierMismatchResolved | Benefits (7.14) | CarrierReconciliationProjection |
| **Wellness Programs** | Wellness program eligibility, enrollment, incentives | V1.1 | Benefits/Engagement | `wellness_programs` | WellnessProgram (6.55): 8 states | CreateWellnessProgram, ApproveWellnessProgram, LaunchWellnessProgram, EnrollInWellnessProgram, RetireWellnessProgram | WellnessProgramCreated, WellnessProgramApproved, WellnessProgramLaunched | Benefits (7.14) | WellnessProgramProjection |
| **Leave Entitlement Engine** | Statutory/company leave entitlement calculations, projections, carryover | V1.2 | Absence Entitlement | `leave_entitlement_calculations`, `leave_balance_projections`, `leave_liability_records` | LeaveEntitlementCalculation (6.82/6.89.6): 8 states | CalculateLeaveEntitlement, ProjectLeaveBalance, SupersedeLeaveEntitlement, CloseLeaveEntitlementPeriod | LeaveEntitlementCalculated, LeaveBalanceProjected, LeaveEntitlementSuperseded | Absence Entitlement (7.23) | LeaveEntitlementProjection |
| **Public Holiday Calendar** | Country/region/site public holiday definitions | V1.2 | Global HR / Absence | `public_holiday_calendars` | — | CreateHolidayCalendar, AddHoliday, PublishHolidayCalendar, UpdateHolidayCalendar | HolidayCalendarCreated, HolidayAdded, HolidayCalendarPublished | Absence Entitlement (7.23) | HolidayCalendarProjection |

**Time, Attendance, Payroll & Benefits Statistics:** 23 features, 10 FSMs, 25+ tables, 10 policy engine integrations


---

### 2.6 Talent, Learning, Performance & Engagement

**Developing, measuring, and engaging the workforce.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **Goal / OKR** | Goal creation, progress tracking, completion, alignment | V1.0 | Performance | `goals` | Goal (6.18): 6 states | CreateGoal, ActivateGoal, UpdateGoalProgress, CompleteGoal, CancelGoal, ArchiveGoal | GoalCreated, GoalActivated, GoalProgressUpdated, GoalCompleted, GoalCancelled | Performance & Calibration (7.7) | GoalDashboardProjection, GoalProgressProjection |
| **Performance Review Cycle** | Review cycle configuration, launch, self/manager/peer review phases | V1.0 | Performance | `performance_review_cycles`, `performance_reviews` | PerformanceReviewCycle (6.17): 13 states | CreateReviewCycle, LaunchReviewCycle, SubmitSelfReview, SubmitManagerReview, StartCalibration, CloseReviewCycle, AcknowledgeReview | ReviewCycleCreated, ReviewCycleLaunched, SelfReviewSubmitted, ManagerReviewSubmitted, CalibrationStarted, ReviewCycleClosed, ReviewAcknowledged | Performance & Calibration (7.7) | ReviewCycleStatusProjection |
| **Calibration Session** | Rating calibration, pay recommendations, audit trail | V1.0 | Performance / Compensation | `calibration_sessions` | — | CreateCalibrationSession, SubmitRating, CalibrateRating, ApproveCalibration | CalibrationSessionCreated, RatingSubmitted, RatingCalibrated, CalibrationApproved | Performance & Calibration (7.7), Compensation/Equity (7.11) | CalibrationProjection |
| **Performance Improvement Plan** | PIP lifecycle management with check-ins and evidence | V1.0 | Performance / Employee Relations | `performance_improvement_plans` | PIP (3.1/6.24): 8 states | CreatePerformanceImprovementPlan, ApprovePip, StartPip, RecordPipCheckIn, ExtendPip, CompletePip, FailPip, ClosePip | PipDrafted, PipApproved, PipStarted, PipCheckInRecorded, PipExtended, PipCompleted, PipFailed, PipClosed | Performance & Calibration (7.7), ER & Disciplinary (7.8) | PIPStatusProjection |
| **Continuous Feedback** | Ongoing feedback visibility and permissions | V1.0 | Performance | `review_feedback_items` | — | SubmitFeedback, RequestFeedback, PublishFeedback, ArchiveFeedback | FeedbackSubmitted, FeedbackPublished, FeedbackArchived | Performance & Calibration (7.7) | FeedbackFeedProjection |
| **Learning Course** | Course catalog, versions, prerequisites, content management | V1.0 | Learning | `learning_courses` | — | CreateCourse, PublishCourse, RetireCourse | LearningCourseCreated, LearningCoursePublished, LearningCourseRetired | Learning Delivery (7.24) | CourseCatalogProjection |
| **Learning Assignment** | Assignment, completion tracking, overdue, waiver | V1.0 | Learning | `learning_assignments` | LearningAssignment (6.19): 7 states | AssignLearning, StartLearning, RecordLearningCompletion, MarkLearningOverdue, WaiveLearning, CancelLearning | LearningAssigned, LearningStarted, LearningCompleted, LearningOverdue, LearningWaived | Learning Delivery (7.24) | LearningAssignmentProjection |
| **Skill Profile** | Worker skills, proficiency, validation, expiry | V1.0 | Skills/Talent | `skill_profiles`, `skill_evidence` | SkillProfile (6.20): 7 states | AddSkillEvidence, VerifySkill, ExpireSkill, RevokeSkill | SkillEvidenceAdded, SkillVerified, SkillExpired, SkillRevoked | Talent & Succession (7.9) | SkillProfileProjection |
| **Certification** | Credential issuance, renewal, expiry, revocation | V1.0 | Learning/Compliance | `certifications` | — | IssueCertification, RenewCertification, ExpireCertification, RevokeCertification | CertificationIssued, CertificationRenewed, CertificationExpired, CertificationRevoked | Learning Delivery (7.24) | CertificationProjection |
| **Career Path** | Career progression paths and role readiness | V1.0 | Talent | `career_paths` | — | CreateCareerPath, PublishCareerPath, UpdateCareerPath, RetireCareerPath | CareerPathCreated, CareerPathPublished, CareerPathRetired | Talent & Succession (7.9) | CareerPathProjection |
| **Talent Pool** | Nomination, readiness tracking, mobility | V1.0 | Talent Management | `talent_pools`, `talent_pool_memberships` | Talent Pool (3.1): 4 states | CreateTalentPool, AddWorkerToTalentPool, RemoveWorkerFromTalentPool, ArchiveTalentPool | TalentPoolCreated, WorkerAddedToTalentPool, WorkerRemovedFromTalentPool, TalentPoolArchived | Talent & Succession (7.9) | TalentPoolProjection |
| **Succession Plan** | Critical roles, successors, readiness, risk assessment | V1.0 | Talent Management | `succession_plans`, `succession_candidates` | SuccessionPlan (6.21): 9 states | DraftSuccessionPlan, NominateSuccessor, ReviewSuccessionPlan, ApproveSuccessionPlan, ArchiveSuccessionPlan | SuccessionPlanDrafted, SuccessorNominated, SuccessionPlanReviewed, SuccessionPlanApproved | Talent & Succession (7.9) | SuccessionPlanProjection |
| **Engagement Survey** | Annual, pulse, lifecycle surveys with anonymity controls | V1.0 | Engagement | `engagement_surveys`, `engagement_survey_responses`, `engagement_action_plans` | EngagementSurvey (6.27): 11 states | DraftSurvey, ScheduleSurvey, LaunchSurvey, RecordSurveyResponse, CloseSurvey, PublishSurveyInsights, CreateEngagementActionPlan | SurveyDrafted, SurveyScheduled, SurveyLaunched, SurveyResponseRecorded, SurveyClosed, SurveyInsightsPublished | Engagement & Recognition (7.19) | SurveyResultsProjection, EngagementTrendProjection |
| **Recognition Program** | Peer recognition, awards, program configuration | V1.1 | Engagement | `recognition_programs`, `recognition_records` | RecognitionProgram (6.71): 6 states, RecognitionRecord (6.70): 7 states | CreateRecognitionProgram, SubmitRecognition, ApproveRecognition, PublishRecognition, RejectRecognition | RecognitionProgramCreated, RecognitionSubmitted, RecognitionApproved, RecognitionPublished | Engagement & Recognition (7.19) | RecognitionFeedProjection |
| **360 Feedback Cycle** | Multi-rater feedback collection and visibility | V1.1 | Engagement / Performance | `feedback_360_cycles`, `feedback_360_responses` | Feedback360Cycle (6.69): 7 states | LaunchFeedback360, SubmitFeedback360, CloseFeedback360, ArchiveFeedback360 | Feedback360Launched, Feedback360Submitted, Feedback360Closed | Engagement & Recognition (7.19) | Feedback360Projection |
| **Compensation Plan** | Merit/market/bonus/equity planning lifecycle | V1.1 | Compensation Management | `compensation_plans`, `compensation_plan_cycles` | CompensationPlan (6.28): 9 states | DraftCompensationPlan, SubmitCompensationPlanForApproval, ApproveCompensationPlan, ActivateCompensationPlan, SupersedeCompensationPlan | CompensationPlanDrafted, CompensationPlanApproved, CompensationPlanActivated, CompensationPlanSuperseded | Compensation/Equity/Total Rewards (7.11) | CompensationPlanProjection |
| **Bonus Cycle** | Bonus pool allocation, recommendations, calibration, payout staging | V1.1 | Compensation Management | `bonus_cycles`, `bonus_recommendations` | BonusCycle (6.29): 11 states | CreateBonusCycle, AllocateBonusPool, SubmitBonusRecommendation, CalibrateBonusAwards, ApproveBonusCycle, StageBonusPayout | BonusCycleCreated, BonusPoolAllocated, BonusRecommendationSubmitted, BonusAwardsCalibrated, BonusCycleApproved | Compensation/Equity/Total Rewards (7.11) | BonusCycleProjection |
| **Equity Grant** | RSU/option grants, vesting, forfeiture, acceleration | V1.1 | Equity/Compensation | `equity_grants`, `equity_vesting_events` | EquityGrant (6.30): 10 states | DraftEquityGrant, ApproveEquityGrant, IssueEquityGrant, RecordVestingEvent, ForfeitEquityGrant, AccelerateVesting, CancelEquityGrant | EquityGrantDrafted, EquityGrantApproved, EquityGrantIssued, EquityVestingRecorded, EquityGrantForfeited, EquityVestingAccelerated | Compensation/Equity/Total Rewards (7.11) | EquityGrantProjection, VestingScheduleProjection |
| **Variable/Commission Plan** | Commission/variable pay definitions, attainment, payout | V1.1 | Compensation Management | `variable_comp_plans`, `commission_attainment_records` | VariableCompPlan (6.31): 10 states | DraftVariableCompPlan, ApproveVariableCompPlan, AssignVariableCompPlan, RecordAttainment, ApproveCommissionPayout, StageCommissionPayout | VariableCompPlanApproved, VariableCompPlanAssigned, VariableAttainmentRecorded, CommissionPayoutApproved | Compensation/Equity/Total Rewards (7.11) | VariableCompProjection |
| **Total Compensation Statement** | Employee-visible total rewards statements | V1.1 | Compensation Management | `total_compensation_statements` | TotalCompensationStatement (6.32): 10 states | GenerateTotalCompStatement, PublishTotalCompStatement, RevokeTotalCompStatement, ArchiveTotalCompStatement | TotalCompStatementGenerated, TotalCompStatementPublished, TotalCompStatementRevoked | Compensation/Equity/Total Rewards (7.11), HR Privacy (7.10) | TotalCompStatementProjection (field-filtered) |
| **Pay Scale / Grade-Step** | Pay scale tables, step progression, union/government scales | V1.2 | Compensation | `pay_scales`, `step_progression_batches`, `step_progression_items` | PayScale/StepProgression (6.85/6.89.9): 10 states | PublishPayScale, AmendPayScale, RetirePayScale, GenerateStepProgressionBatch, ApproveStepProgressionBatch, StageStepProgressionForPayroll | PayScalePublished, PayScaleAmended, StepProgressionBatchGenerated, StepProgressionBatchApproved | Grade-Step/Position-Based Comp (7.28) | PayScaleProjection |
| **Learning Content Package** | SCORM/xAPI package lifecycle and metadata | V1.2 | Learning Delivery | `learning_content_packages` | LearningContentPackage (6.79/6.89.3): 7 states | RegisterLearningContentPackage, ValidateLearningPackage, PublishLearningPackage, RetireLearningPackage | LearningContentPackageRegistered, LearningContentPackageValidated, LearningContentPackagePublished, LearningContentPackageRetired | Learning Delivery (7.24) | ContentPackageProjection |
| **Learning Delivery Session** | Runtime learning sessions and progress snapshots | V1.2 | Learning Delivery | `learning_delivery_sessions`, `learning_xapi_statements` | — | StartLearningDeliverySession, RecordLearningProgress, CompleteLearningDeliverySession, FailLearningDeliverySession | LearningDeliverySessionStarted, LearningProgressRecorded, LearningDeliverySessionCompleted | Learning Delivery (7.24) | LearningSessionProjection |
| **Assessment Attempt** | Quiz/exam attempts, grading, retry, invalidation | V1.2 | Learning Delivery | `assessment_attempts` | — | RecordAssessmentAttempt, GradeAssessment, AllowRetry, InvalidateAssessment | AssessmentAttemptRecorded, AssessmentGraded | Learning Delivery (7.24) | AssessmentProjection |
| **ILT / Virtual Classroom** | Instructor-led training events, attendance, waitlists | V1.2 | Learning Delivery | `ilt_events` | — | CreateILTEvent, ManageWaitlist, RecordAttendance, CancelILTEvent | ILTEventCreated, WaitlistManaged, AttendanceRecorded | Learning Delivery (7.24) | ILTEventProjection |
| **Learning Transcript** | Worker learning transcript and audit evidence | V1.2 | Learning Delivery | `learning_transcripts` | — | GenerateTranscript, UpdateTranscript, ArchiveTranscript | TranscriptGenerated, TranscriptUpdated | Learning Delivery (7.24) | LearningTranscriptProjection |
| **Milestone Recognition** | Anniversary/birthday/service milestone automation | V1.1 | Engagement | `milestone_recognition_events` | — | ConfigureMilestoneRecognition, TriggerMilestone, PublishMilestone | MilestoneConfigured, MilestoneTriggered, MilestonePublished | Engagement & Recognition (7.19) | MilestoneProjection |

**Talent, Learning, Performance & Engagement Statistics:** 27 features, 13 FSMs, 25+ tables, 8 policy engine integrations

---

### 2.7 Employee Relations, Compliance & HR Service Delivery

**Managing risk, ensuring compliance, and delivering HR services.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **Employee Relations Case** | Sensitive ER cases, grievances, complaints, investigations | V1.0 | Employee Relations | `employee_relations_cases`, `er_investigations` | EmployeeRelationsCase (6.23): 11 states | OpenEmployeeRelationsCase, StartInvestigation, RecordFinding, ApproveErActionPlan, CloseEmployeeRelationsCase | EmployeeRelationsCaseOpened, InvestigationStarted, ErFindingRecorded, ErActionPlanApproved, EmployeeRelationsCaseClosed | ER & Disciplinary (7.8), HR Privacy (7.10) | ERCaseProjection (restricted) |
| **Disciplinary Action** | Warnings, suspensions, appeals, closure | V1.0 | Employee Relations | `disciplinary_actions` | DisciplinaryAction (6.24): 11 states | DraftDisciplinaryAction, ReviewDisciplinaryAction, IssueDisciplinaryAction, AcknowledgeDisciplinaryAction, AppealDisciplinaryAction, CloseDisciplinaryAction | DisciplinaryActionDrafted, DisciplinaryActionReviewed, DisciplinaryActionIssued, DisciplinaryActionAcknowledged, DisciplinaryActionAppealed | ER & Disciplinary (7.8), Union & Labor Relations (7.20) | DisciplinaryActionProjection |
| **Accommodation Case** | Disability, medical, workplace accommodation, return-to-work | V1.0 | Employee Relations / Compliance | `accommodation_cases` | AccommodationCase (6.25): 11 states | RequestAccommodation, StartInteractiveProcess, ApproveAccommodation, ImplementAccommodation, ReviewAccommodation, CloseAccommodation | AccommodationRequested, InteractiveProcessStarted, AccommodationApproved, AccommodationImplemented, AccommodationReviewed | ER & Disciplinary (7.8) | AccommodationCaseProjection |
| **Policy Acknowledgement** | Policy assignment, viewing, acknowledgement, overdue tracking | V1.0 | Compliance | `policy_acknowledgements`, `policy_documents` | PolicyAcknowledgement (6.26): 8 states | AssignPolicyAcknowledgement, RecordPolicyViewed, RecordPolicyAcknowledged, MarkPolicyOverdue, WaivePolicyAcknowledgement | PolicyAcknowledgementAssigned, PolicyViewed, PolicyAcknowledged, PolicyAcknowledgementOverdue | Employment Eligibility (7.1) | PolicyAcknowledgementProjection |
| **Statutory Report** | Country-specific statutory reports and government filing | V1.0 | HR Compliance | `statutory_reports`, `government_filing_events` | StatutoryReport (6.48): 10 states | GenerateStatutoryReport, SubmitStatutoryReport, AcceptStatutoryReport, RejectStatutoryReport, AmendStatutoryReport | StatutoryReportGenerated, StatutoryReportSubmitted, StatutoryReportAccepted, StatutoryReportRejected | Global Labor-Law (7.13), DEI/Analytics (7.18) | StatutoryReportProjection |
| **Work Authorization** | Visa/permit/right-to-work cases and renewals | V1.0 | Global HR Compliance | `work_authorization_cases` | WorkAuthorizationCase (6.47): 11 states | OpenWorkAuthorizationCase, SubmitWorkAuthorizationEvidence, RecordGovernmentFiling, ApproveWorkAuthorization, RejectWorkAuthorization, RenewWorkAuthorization | WorkAuthorizationCaseOpened, WorkAuthorizationEvidenceSubmitted, GovernmentFilingRecorded, WorkAuthorizationApproved | Employment Eligibility (7.1) | WorkAuthStatusProjection |
| **Legal Hold** | Litigation holds on employee records | V1.0 | Legal / Compliance | `hr_legal_holds` | — | CreateLegalHold, ApplyLegalHold, ReleaseLegalHold, ExtendLegalHold | LegalHoldCreated, LegalHoldApplied, LegalHoldReleased | HR Privacy (7.10) | LegalHoldProjection |
| **HR Knowledge Article** | HR knowledge/FAQ articles with versioning and review | V1.1 | HR Service Delivery | `hr_knowledge_articles`, `hr_knowledge_article_versions` | HrKnowledgeArticle (6.57): 8 states | DraftHrKnowledgeArticle, SubmitHrKnowledgeArticleForReview, ApproveHrKnowledgeArticle, PublishHrKnowledgeArticle, RetireHrKnowledgeArticle | HrKnowledgeArticleDrafted, HrKnowledgeArticleApproved, HrKnowledgeArticlePublished | HR Service Delivery (7.15) | KnowledgeArticleProjection |
| **HR Service Catalog** | Requestable HR services with workflow and SLA | V1.1 | HR Service Delivery | `hr_service_catalog_items` | HrServiceCatalogItem (6.58): 6 states | DraftHrServiceItem, PublishHrServiceItem, RetireHrServiceItem, ArchiveHrServiceItem | HrServiceItemDrafted, HrServiceItemPublished | HR Service Delivery (7.15) | ServiceCatalogProjection |
| **Virtual Agent Session** | HR bot/chat sessions with handoff governance | V1.1 | HR Service Delivery / HR AI Governance | `hr_virtual_agent_sessions` | HrVirtualAgentSession (6.59): 9 states | StartVirtualAgentSession, IdentifyIntent, EscalateToAgent, ResolveViaSelfService | VirtualAgentSessionStarted, IntentIdentified, HandoffRequested | HR Service Delivery (7.15), HR AI Governance (7.21) | VirtualAgentSessionProjection |
| **Case SLA Management** | SLA/OLA tracking for HR service cases | V1.1 | HR Service Delivery | `hr_case_sla_instances` | HrCaseSlaInstance (6.60): 8 states | CreateSlaInstance, ActivateSlaInstance, PauseSlaInstance, RecordSlaFulfillment, RecordSlaBreach | SlaInstanceCreated, SlaInstanceActivated, SlaBreachRecorded | HR Service Delivery (7.15) | SlaDashboardProjection |
| **Employee Self-Service** | Employee command portal with allowlist governance | V1.1 | Employee Self-Service | `self_service_requests` | — | SubmitSelfServiceRequest, CancelSelfServiceRequest | SelfServiceRequestSubmitted, SelfServiceRequestCancelled | Self-Service Authority (7.16) | SelfServiceRequestProjection |
| **Benefits Comparison** | Advisory benefits decision-support (non-authoritative) | V1.1 | Benefits Management | `benefits_comparison_sessions` | BenefitsComparisonSession (6.56): 6 states | StartComparisonSession, PresentOptions, RecordElectionStart | ComparisonSessionStarted, OptionsPresented | Benefits (7.14) | BenefitsComparisonProjection |

**Employee Relations, Compliance & HR Service Delivery Statistics:** 13 features, 10 FSMs, 16+ tables, 9 policy engine integrations

---

### 2.8 Global HR, Localization & Country Policy Governance

**Country-specific labor law, policy packs, and statutory compliance.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **Country Labor Rule Set** | Country-specific labor-law, payroll, leave, notice, probation rules | V1.1 | Global HR Compliance | `global_country_rule_sets`, `labor_law_rules` | — | DraftCountryRuleSet, ValidateCountryRuleSet, ApproveCountryRuleSet, PublishCountryRuleSet, SupersedeCountryRuleSet, RetireCountryRuleSet | CountryRuleSetDrafted, CountryRuleSetPublished, CountryRuleSetSuperseded, CountryRuleSetRetired | Global Labor-Law (7.13) | CountryRuleSetProjection |
| **Country Policy Pack** | Upload, validate, simulate, approve, publish, rollback country-specific HR policy | V1.4 | Global HR Compliance / Country Policy Governance | `country_policy_packs`, `country_policy_pack_sections` | CountryPolicyPack (6.46): 22 states | UploadCountryPolicyPack, ValidateCountryPolicyPack, SimulateCountryPolicyImpact, RequestCountryPolicyApproval, RecordCountryPolicyApproval, ApproveCountryPolicyPack, RejectCountryPolicyPack, ScheduleCountryPolicyPublication, PublishCountryPolicyPack, SupersedeCountryPolicyPack, RollBackCountryPolicyPack, RetireCountryPolicyPack | CountryPolicyPackUploaded, CountryPolicyPackValidated, CountryPolicyImpactSimulated, CountryPolicyApprovalRequested, CountryPolicyPackApproved, CountryPolicyPackRejected, CountryPolicyPackPublished, CountryPolicyPackSuperseded, CountryPolicyPackRolledBack | Global Labor-Law (7.13) | CountryPolicyPackProjection |
| **Country Policy Upload** | Raw upload metadata, parsing, quarantine, validation batch | V1.4 | Country Policy Governance | `country_policy_uploads` | — | UploadCountryPolicyPack, ParseCountryPolicyUpload, QuarantineCountryPolicyUpload, RejectCountryPolicyUpload | CountryPolicyPackUploaded, CountryPolicyUploadParsed, CountryPolicyUploadQuarantined, CountryPolicyUploadRejected | Global Labor-Law (7.13) | PolicyUploadProjection |
| **Country Policy Validation** | Schema, semantic, evidence, overlap, dependency validation | V1.4 | Country Policy Governance | `country_policy_validation_runs` | — | ValidateCountryPolicyPack, RunSchemaValidation, RunSemanticValidation | CountryPolicyValidationRunStarted, CountryPolicyValidationCompleted | Global Labor-Law (7.13) | ValidationRunProjection |
| **Country Policy Impact Simulation** | Simulation of impacted workers, payroll, tax, leave, benefits | V1.4 | Country Policy Governance / Impact Analysis | `country_policy_impact_simulations` | — | SimulateCountryPolicyImpact, ReviewImpactSimulation, AcceptSimulationResults | CountryPolicyImpactSimulated, ImpactSimulationReviewed | Global Labor-Law (7.13), Payroll Calculation (7.21) | ImpactSimulationProjection |
| **Country Policy Approval Step** | Required approval steps by section with approver roles and SoD | V1.4 | Approval Management / Country Policy Governance | `country_policy_approval_steps` | — | RequestCountryPolicyApproval, RecordCountryPolicyApproval, ExpireCountryPolicyApproval, CancelCountryPolicyApproval | CountryPolicyApprovalRequested, CountryPolicyApprovalRecorded, CountryPolicyApprovalExpired | Global Labor-Law (7.13) | PolicyApprovalProjection |
| **Country Policy Publication** | Effective publication, activation, rollback, supersession | V1.4 | Country Policy Governance | `country_policy_publications` | — | ScheduleCountryPolicyPublication, PublishCountryPolicyPack, RollBackCountryPolicyPack | CountryPolicyPublicationScheduled, CountryPolicyPackPublished, CountryPolicyPackRolledBack | Global Labor-Law (7.13) | PolicyPublicationProjection |
| **Country Policy Recalculation Jobs** | Downstream revalidation/recalculation triggered by policy changes | V1.4 | Country Policy Governance / Reconciliation | `country_policy_recalculation_jobs` | — | TriggerRecalculationJob, ApproveRecalculationJob, MonitorRecalculationJob | RecalculationJobTriggered, RecalculationJobApproved | Payroll Calculation (7.21), Absence Entitlement (7.23) | RecalculationJobProjection |
| **Statutory Leave Type** | Country-specific statutory leave definitions | V1.1 | Global HR Compliance / Time | `statutory_leave_types` | — | PublishStatutoryLeaveType, AmendStatutoryLeaveType, RetireStatutoryLeaveType | StatutoryLeaveTypePublished, StatutoryLeaveTypeAmended | Absence Entitlement (7.23), Global Labor-Law (7.13) | StatutoryLeaveTypeProjection |
| **Works Council Consultation** | Co-determination consultation lifecycle and blocker evidence | V1.1 | Labor Relations | `works_council_consultations` | WorksCouncilConsultation (6.49): 9 states | RequestWorksCouncilConsultation, RecordWorksCouncilFeedback, ApproveWorksCouncilOutcome, RejectWorksCouncilOutcome, CloseWorksCouncilConsultation | WorksCouncilConsultationRequested, WorksCouncilFeedbackRecorded, WorksCouncilOutcomeApproved | Union & Labor Relations (7.20), Global Labor-Law (7.13) | WorksCouncilProjection |
| **Local Contract Type Rules** | Local employment contract types and constraints | V1.1 | Global HR Compliance / Contracts | `local_contract_type_rules` | — | PublishContractTypeRule, AmendContractTypeRule, RetireContractTypeRule | ContractTypeRulePublished, ContractTypeRuleAmended | Global Labor-Law (7.13) | ContractTypeRuleProjection |
| **Notice Period Rules** | Statutory and contractual notice period rules | V1.1 | Global HR Compliance | `notice_period_rules` | — | PublishNoticePeriodRule, AmendNoticePeriodRule, RetireNoticePeriodRule | NoticePeriodRulePublished, NoticePeriodRuleAmended | Global Labor-Law (7.13) | NoticePeriodRuleProjection |

**Global HR, Localization & Country Policy Governance Statistics:** 12 features, 2 FSMs, 12+ tables, 5 policy engine integrations

---

### 2.9 Workforce Management & Scheduling

**Shift planning, scheduling, and time management for hourly/workforce operations.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **Shift Schedule** | Per-team/person shift schedule creation, publication, adjustment | V1.1 | Workforce Management | `shift_schedules`, `shift_assignments` | ShiftSchedule (6.39): 10 states | DraftShiftSchedule, PublishShiftSchedule, AdjustShiftSchedule, LockShiftSchedule, CancelShiftSchedule, ArchiveShiftSchedule | ShiftScheduleDrafted, ShiftSchedulePublished, ShiftScheduleAdjusted, ShiftScheduleLocked | Workforce Mgmt Scheduling (7.12) | ShiftScheduleProjection |
| **Open Shift** | Open shifts available for employee bidding | V1.1 | Workforce Management | `open_shifts` | OpenShift (6.40): 7 states | CreateOpenShift, PublishOpenShift, FillOpenShift, CancelOpenShift, ExpireOpenShift | OpenShiftCreated, OpenShiftFilled, OpenShiftCancelled | Workforce Mgmt Scheduling (7.12) | OpenShiftProjection |
| **Shift Bid** | Employee bid lifecycle for open shifts | V1.1 | Workforce Management | `shift_bids` | ShiftBid (6.41): 6 states | SubmitShiftBid, ApproveShiftBid, RejectShiftBid, WithdrawShiftBid | ShiftBidSubmitted, ShiftBidApproved, ShiftBidRejected | Workforce Mgmt Scheduling (7.12) | ShiftBidProjection |
| **Shift Swap Request** | Employee-to-employee shift swap with approval | V1.1 | Workforce Management | `shift_swap_requests` | ShiftSwapRequest (6.42): 9 states | RequestShiftSwap, ApproveShiftSwap, RejectShiftSwap, ExecuteShiftSwap, CancelShiftSwap | ShiftSwapRequested, ShiftSwapApproved, ShiftSwapRejected, ShiftSwapExecuted | Workforce Mgmt Scheduling (7.12) | ShiftSwapProjection |
| **Overtime Approval** | Overtime request, approval, worked evidence | V1.1 | Workforce Management / Time | `overtime_approvals` | OvertimeApproval (6.43): 8 states | RequestOvertime, ApproveOvertime, RejectOvertime, RecordOvertimeWorked, CancelOvertimeApproval | OvertimeRequested, OvertimeApproved, OvertimeRejected, OvertimeWorkedRecorded | Workforce Mgmt Scheduling (7.12) | OvertimeProjection |
| **Coverage Gap** | Detected coverage gaps and fill status tracking | V1.1 | Workforce Management | `coverage_gap_events` | CoverageGap (6.44): 7 states | DetectCoverageGap, CreateFillPlan, ExecuteFillPlan, ResolveCoverageGap, EscalateCoverageGap | CoverageGapDetected, FillPlanCreated, CoverageGapResolved | Workforce Mgmt Scheduling (7.12) | CoverageGapProjection |
| **Schedule Adherence** | Real-time clock/schedule adherence tracking | V1.1 | Workforce Management / Time | `schedule_adherence_records` | ScheduleAdherence (6.45): 10 states | RecordAdherenceEvent, ReviewAdherenceException, ApproveAdherenceException | AdherenceEventRecorded, AdherenceExceptionReviewed | Workforce Mgmt Scheduling (7.12), Time & Absence (7.5) | ScheduleAdherenceProjection |
| **Mobile Clock Events** | Mobile clock-in/out with GPS/geofence evidence | V1.2 | Time / HR Mobile | `mobile_clock_events` | — | RecordMobileClockEvent, ValidateGeofence, FlagOffsiteClock | MobileClockRecorded, GeofenceValidated | Workforce Mgmt Scheduling (7.12) | MobileClockProjection |

**Workforce Management & Scheduling Statistics:** 8 features, 7 FSMs, 8 tables, 2 policy engine integrations

---

### 2.10 DEI, People Analytics & Reporting

**Diversity, equity, inclusion analytics, and the ad-hoc reporting platform.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **DEI Report** | Diversity and workforce demographic reporting with minimum cell thresholds | V1.1 | People Analytics / Compliance | `dei_reports` | DeiReport (6.66): 10 states | GenerateDeiReport, SuppressSmallCellData, ApproveDeiReport, PublishDeiReport, ArchiveDeiReport | DeiReportGenerated, SmallCellDataSuppressed, DeiReportApproved, DeiReportPublished | DEI/Analytics (7.18), HR Privacy (7.10) | DEIReportProjection |
| **Pay Gap Report** | Pay gap calculation, publication, remediation tracking | V1.1 | People Analytics / Compliance | `pay_gap_reports` | PayGapReport (6.67): 9 states | GeneratePayGapReport, SuppressPayGapData, ApprovePayGapReport, PublishPayGapReport, AmendPayGapReport | PayGapReportGenerated, PayGapDataSuppressed, PayGapReportPublished | DEI/Analytics (7.18) | PayGapReportProjection |
| **Pay Equity Audit** | Pay equity analysis, findings, and remediation plan | V1.1 | Compensation / DEI Compliance | `pay_equity_reviews` | PayEquityAudit (6.68): 10 states | StartPayEquityAudit, RecordPayEquityFinding, ApprovePayEquityActionPlan, ClosePayEquityAudit | PayEquityAuditStarted, PayEquityFindingRecorded, PayEquityActionPlanApproved | Compensation/Equity (7.11), DEI/Analytics (7.18) | PayEquityAuditProjection |
| **Promotion Equity Report** | Promotion rate analysis by demographic segment | V1.1 | People Analytics / Compliance | `promotion_equity_reports` | — | GeneratePromotionEquityReport, SuppressPromotionData, PublishPromotionEquityReport | PromotionEquityReportGenerated, PromotionDataSuppressed | DEI/Analytics (7.18) | PromotionEquityProjection |
| **Attrition Segment Report** | Attrition metrics with minimum cell thresholds | V1.1 | People Analytics / Compliance | `attrition_segment_reports` | — | GenerateAttritionReport, SuppressAttritionData, PublishAttritionReport | AttritionReportGenerated, AttritionDataSuppressed | DEI/Analytics (7.18) | AttritionSegmentProjection |
| **Manager Diversity Report** | Manager population and distribution analytics | V1.1 | People Analytics / Compliance | `manager_diversity_reports` | — | GenerateManagerDiversityReport, PublishManagerDiversityReport | ManagerDiversityReportGenerated | DEI/Analytics (7.18) | ManagerDiversityProjection |
| **Ad-Hoc Reporting Platform** | Governed report builder, matrix/pivot, calculated fields | V1.2 | Reporting Platform | `report_definitions`, `report_executions`, `calculated_fields` | ReportDefinition (6.80/6.89.4): 8 states | DraftReportDefinition, ValidateReportDefinition, PublishReportDefinition, ScheduleReport, RetireReportDefinition | ReportDefinitionDrafted, ReportDefinitionPublished, ReportScheduled | Reporting/Analytics (7.25), HR Privacy (7.10) | ReportLibraryProjection |
| **Report Execution & Export** | Report runs, delivery, warehouse export | V1.2 | Reporting Platform | `report_executions`, `report_schedules`, `warehouse_export_jobs` | — | RunReport, ExportReport, CancelReportExecution, ArchiveReportExecution | ReportExecutionStarted, ReportExecutionCompleted, ReportExported | Reporting/Analytics (7.25), HR Privacy (7.10) | ReportExecutionProjection |
| **Workforce Planning Plus** | FTE budget reconciliation, contingent workforce planning | V1.1 | Workforce Planning | `fte_budget_reconciliations`, `contingent_workforce_plans` | FteBudgetReconciliation (6.65): 7 states | OpenFteReconciliation, MatchFteToActual, ReviewFteExceptions, ResolveFteVariance | FteReconciliationOpened, FteMatched, FteExceptionReviewed | Workforce Planning (7.17) | FteReconciliationProjection |
| **Analytics Suppression Log** | Small-cell suppression and privacy-protection evidence | V1.1 | People Analytics / Privacy | `analytics_suppression_logs` | — | RecordSuppression, AuditSuppression, PublishSuppressionLog | SuppressionRecorded, SuppressionAudited | DEI/Analytics (7.18), HR Privacy (7.10) | SuppressionLogProjection |

**DEI, People Analytics & Reporting Statistics:** 10 features, 4 FSMs, 13+ tables, 4 policy engine integrations

---

### 2.11 HR Mobile Platform

**Mobile HR capabilities with offline support and governance.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **Mobile Device Registration** | Device registration, trust, push tokens, risk lifecycle | V1.2 | HR Mobile Platform | `hr_mobile_devices` | HR Mobile Device (6.86/6.89.10): 12 states | RegisterHrMobileDevice, RotateMobilePushToken, SuspendHrMobileDevice, RevokeHrMobileDevice | HrMobileDeviceRegistered, MobilePushTokenRotated, HrMobileDeviceSuspended, HrMobileDeviceRevoked | Self-Service Authority (7.16) | MobileDeviceProjection |
| **Mobile Offline Package** | Scoped offline data packages for mobile operation | V1.2 | HR Mobile Platform | `hr_mobile_offline_packages` | MobileOfflinePackage (6.86): 6 states | GenerateHrMobileOfflinePackage, AcknowledgeHrMobilePackage, SubmitHrMobileSyncBatch, RejectHrMobileSyncItem | HrMobilePackageGenerated, HrMobilePackageAcknowledged, HrMobileSyncBatchSubmitted, HrMobileSyncItemRejected | Self-Service Authority (7.16), HR Privacy (7.10) | OfflinePackageProjection |
| **Mobile Sync** | Bidirectional sync batches with conflict resolution | V1.2 | HR Mobile Platform | `hr_mobile_sync_batches` | — | SubmitSyncBatch, AcceptSyncItem, RejectSyncItem, ResolveSyncConflict | SyncBatchSubmitted, SyncItemAccepted, SyncItemRejected | Self-Service Authority (7.16) | MobileSyncProjection |
| **Mobile Clock** | Mobile clock-in/out with geofence and biometric step-up | V1.2 | Time / HR Mobile | `mobile_clock_events` | — | RecordMobileClock, ValidateGeofence, RequestBiometricStepUp | MobileClockRecorded, GeofenceValidated | Workforce Mgmt Scheduling (7.12), Self-Service (7.16) | MobileClockProjection |
| **Mobile Approval** | Manager approvals via mobile with offline capability | V1.2 | HR Mobile Platform / Manager Self-Service | `manager_action_requests` (mobile view) | — | SubmitMobileApproval, RecordOfflineApproval, SyncPendingApprovals | MobileApprovalSubmitted, OfflineApprovalRecorded | Self-Service Authority (7.16) | MobileApprovalProjection |

**HR Mobile Platform Statistics:** 5 features, 2 FSMs, 4 tables, 3 policy engine integrations

---

### 2.12 Wellbeing, EAP & Financial Wellness

**Employee wellbeing, EAP referrals, and financial wellness integrations.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **EAP Referral** | Employee Assistance Program referral lifecycle with privacy | V1.2 | Wellbeing / EAP | `eap_referrals` | Wellbeing/EAP (6.88/6.89.12): 11 states | CreateEapReferral, AnonymizeEapUsage, CloseEapReferral | EapReferralCreated, EapUsageAnonymized, EapReferralClosed | Wellbeing/EAP Privacy (7.30), HR Privacy (7.10) | EAPReferralProjection (anonymized) |
| **Wellness Program** | Wellbeing program management and enrollment | V1.1 | Benefits/Engagement | `wellness_programs` | WellnessProgram (6.55): 8 states | CreateWellnessProgram, ApproveWellnessProgram, LaunchWellnessProgram, EnrollInWellnessProgram | WellnessProgramCreated, WellnessProgramLaunched | Benefits (7.14) | WellnessProgramProjection |
| **Wellness Claims** | Wellness reimbursement/claim lifecycle | V1.2 | Wellbeing | `wellness_claims` | — | SubmitWellnessClaim, ApproveWellnessClaim, ReimburseWellnessClaim | WellnessClaimSubmitted, WellnessClaimApproved, WellnessClaimReimbursed | Wellbeing/EAP Privacy (7.30) | WellnessClaimProjection |
| **Financial Wellness** | EWA/financial wellness request lifecycle | V1.2 | Wellbeing / Payroll Integration | `financial_wellness_requests` | — | SubmitFinancialWellnessRequest, ApproveFinancialWellnessRequest | FinancialWellnessRequestSubmitted, FinancialWellnessRequestApproved | Wellbeing/EAP Privacy (7.30) | FinancialWellnessProjection |
| **Anonymous EAP Usage** | Aggregate EAP usage below privacy thresholds | V1.2 | Wellbeing / Analytics | `eap_anonymous_usage_rollups` | — | GenerateAnonymousRollups, AuditAnonymousUsage | AnonymousRollupsGenerated | Wellbeing/EAP Privacy (7.30), DEI/Analytics (7.18) | AnonymousEAPUsageProjection |

**Wellbeing, EAP & Financial Wellness Statistics:** 5 features, 1 FSM, 5 tables, 3 policy engine integrations

---

### 2.13 Union & Labor Relations

**Collective bargaining, grievances, works council, and labor action management.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **Union Contract / CBA** | Collective bargaining agreement lifecycle | V1.1 | Labor Relations | `union_contracts`, `union_contract_rules` | UnionContract (6.72): 8 states | DraftUnionContract, ApproveUnionContract, ActivateUnionContract, AmendUnionContract, ExpireUnionContract, ArchiveUnionContract | UnionContractDrafted, UnionContractApproved, UnionContractActivated, UnionContractAmended, UnionContractExpired | Union & Labor Relations (7.20), Global Labor-Law (7.13) | UnionContractProjection |
| **Union Membership** | Worker union membership and coverage mapping | V1.1 | Labor Relations | `union_memberships` | — | EnrollUnionMember, UpdateUnionMembership, EndUnionMembership | UnionMemberEnrolled, UnionMembershipUpdated, UnionMembershipEnded | Union & Labor Relations (7.20) | UnionMembershipProjection |
| **Union Grievance** | Grievance lifecycle with filing deadlines and arbitration | V1.1 | Labor Relations | `union_grievances` | UnionGrievance (6.73): 10 states | FileUnionGrievance, AcknowledgeUnionGrievance, InvestigateUnionGrievance, RecordArbitration, ResolveUnionGrievance, CloseUnionGrievance | UnionGrievanceFiled, UnionGrievanceAcknowledged, UnionGrievanceInvestigationStarted, UnionArbitrationRecorded, UnionGrievanceResolved | Union & Labor Relations (7.20) | UnionGrievanceProjection |
| **Labor Action Event** | Strike, lockout, work stoppage, emergency staffing | V1.1 | Labor Relations | `labor_action_events` | LaborActionEvent (6.74): 7 states | ReportLaborAction, AssessLaborRisk, ActivateContingencyPlan, ResolveLaborAction, CloseLaborActionEvent | LaborActionReported, LaborRiskAssessed, ContingencyActivated, LaborActionResolved | Union & Labor Relations (7.20) | LaborActionProjection |
| **Steward Assignment** | Union steward/representative assignment tracking | V1.1 | Labor Relations | `steward_assignments` | — | AssignSteward, UpdateStewardScope, EndStewardAssignment | StewardAssigned, StewardScopeUpdated, StewardAssignmentEnded | Union & Labor Relations (7.20) | StewardAssignmentProjection |
| **Works Council Consultation** | Co-determination consultation and blocker management | V1.1 | Labor Relations | `works_council_consultations` | WorksCouncilConsultation (6.49): 9 states | RequestWorksCouncilConsultation, RecordWorksCouncilFeedback, ApproveWorksCouncilOutcome, CloseWorksCouncilConsultation | WorksCouncilConsultationRequested, WorksCouncilFeedbackRecorded, WorksCouncilOutcomeApproved | Union & Labor Relations (7.20), Global Labor-Law (7.13) | WorksCouncilProjection |

**Union & Labor Relations Statistics:** 6 features, 4 FSMs, 6 tables, 3 policy engine integrations

---

### 2.14 HR AI Governance

**Governing AI use in HR: bias testing, human oversight, kill switches, and transparency.**

| Feature | Description | Ver | Authority Owner | Canonical Tables | FSM | Key Commands | Key Events | Policy Engines | Projections |
|---------|-------------|-----|-----------------|-------------------|-----|-------------|-----------|----------------|------------|
| **AI Use Case Registry** | Approved HR AI use cases with high-risk classification | V1.1 | HR AI Governance | `hr_ai_use_cases` | HrAiUseCase (6.75): 11 states | RegisterHrAiUseCase, ApproveHrAiUseCase, SuspendHrAiUseCase, RecordHrAiModelRun, RecordHrAiBiasTest, DisableHrAiUseCase | HrAiUseCaseRegistered, HrAiUseCaseApproved, HrAiUseCaseSuspended, HrAiModelRunRecorded, HrAiBiasTestRecorded, HrAiUseCaseDisabled | HR AI Governance (7.21) | AIUseCaseRegistryProjection |
| **AI Model Run Tracking** | Model invocation metadata, input/output hashes, reviewer link | V1.1 | HR AI Governance | `hr_ai_model_runs` | — | RecordModelRun, LinkToHumanReviewer, ArchiveModelRun | ModelRunRecorded, HumanReviewerLinked | HR AI Governance (7.21) | ModelRunHistoryProjection |
| **AI Bias Testing** | Bias/fairness test runs with thresholds and remediation | V1.1 | HR AI Governance | `hr_ai_bias_tests` | — | RunBiasTest, RecordBiasResult, TriggerRemediation | BiasTestRun, BiasResultRecorded | HR AI Governance (7.21), DEI/Analytics (7.18) | BiasTestResultsProjection |
| **Human Review Decisions** | Human accept/reject/override decisions on AI outputs | V1.1 | HR AI Governance | `hr_ai_human_review_decisions` | — | RecordHumanReview, OverrideAiDecision, EscalateAiDecision | HumanReviewRecorded, AiDecisionOverridden | HR AI Governance (7.21) | HumanReviewProjection |
| **AI Kill Switch** | Tenant/platform use-case disablement for safety | V1.1 | HR AI Governance / Security | `hr_ai_kill_switches` | — | ActivateKillSwitch, DeactivateKillSwitch, AuditKillSwitchUsage | KillSwitchActivated, KillSwitchDeactivated | HR AI Governance (7.21) | KillSwitchStatusProjection |
| **AI Safety Findings** | Safety, bias, and legal findings with mitigation tracking | V1.1 | HR AI Governance | `hr_ai_safety_findings` | — | RecordSafetyFinding, AssignMitigation, CloseSafetyFinding | SafetyFindingRecorded, MitigationAssigned, SafetyFindingClosed | HR AI Governance (7.21) | SafetyFindingsProjection |

**HR AI Governance Statistics:** 6 features, 1 FSM, 6 tables, 1 policy engine integration


---

## 3. Mermaid Feature Hierarchy Diagram

```mermaid
graph TD
    HR["Enterprise HR/HCM Platform v1.4"]

    HR --> F1["2.1 HR Platform Foundation"]
    HR --> F2["2.2 Core HR & Organization"]
    HR --> F3["2.3 Talent Acquisition & Onboarding"]
    HR --> F4["2.4 Employment Lifecycle & Service Delivery"]
    HR --> F5["2.5 Time, Attendance, Payroll & Benefits"]
    HR --> F6["2.6 Talent, Learning, Performance & Engagement"]
    HR --> F7["2.7 ER, Compliance & HR Service Delivery"]
    HR --> F8["2.8 Global HR, Localization & Country Policy"]
    HR --> F9["2.9 Workforce Management & Scheduling"]
    HR --> F10["2.10 DEI, People Analytics & Reporting"]
    HR --> F11["2.11 HR Mobile Platform"]
    HR --> F12["2.12 Wellbeing, EAP & Financial Wellness"]
    HR --> F13["2.13 Union & Labor Relations"]
    HR --> F14["2.14 HR AI Governance"]

    F1 --> F1a["HR Tenant Policy"]
    F1 --> F1b["HR Data Privacy"]
    F1 --> F1c["HR Document Platform"]
    F1 --> F1d["HR Approval Management"]
    F1 --> F1e["HR Audit Ledger"]
    F1 --> F1f["HR Workflow Engine"]
    F1 --> F1g["Universal Command Contract"]

    F2 --> F2a["Worker Profile"]
    F2 --> F2b["Personal Data"]
    F2 --> F2c["Employment Relationship"]
    F2 --> F2d["Legal Entity"]
    F2 --> F2e["Organization Unit"]
    F2 --> F2f["Position Control"]
    F2 --> F2g["Job Architecture"]
    F2 --> F2h["Manager Relationship"]
    F2 --> F2i["Compensation Band"]
    F2 --> F2j["Probation Review"]

    F3 --> F3a["Workforce Planning"]
    F3 --> F3b["Headcount Request"]
    F3 --> F3c["Job Requisition"]
    F3 --> F3d["Candidate Profile"]
    F3 --> F3e["Candidate Application"]
    F3 --> F3f["Interview Plan"]
    F3 --> F3g["Assessment"]
    F3 --> F3h["Background Check"]
    F3 --> F3i["Offer Management"]
    F3 --> F3j["Onboarding Plan"]
    F3 --> F3k["Career Site"]
    F3 --> F3l["I-9 / E-Verify"]
    F3 --> F3m["Candidate Referral"]

    F4 --> F4a["Employment Contract"]
    F4 --> F4b["Job Assignment"]
    F4 --> F4c["Transfer/Promotion/Demotion"]
    F4 --> F4d["Compensation Change"]
    F4 --> F4e["Offboarding Plan"]
    F4 --> F4f["Exit Interview"]
    F4 --> F4g["Final Settlement"]
    F4 --> F4h["Reference Request"]
    F4 --> F4i["Alumni Portal"]
    F4 --> F4j["HR Service Case"]
    F4 --> F4k["Employee Life Event"]

    F5 --> F5a["Work Schedule"]
    F5 --> F5b["Time Clock"]
    F5 --> F5c["Timesheet"]
    F5 --> F5d["Attendance Exception"]
    F5 --> F5e["Absence Request"]
    F5 --> F5f["Leave Case"]
    F5 --> F5g["Accrual Balance"]
    F5 --> F5h["Payroll Input"]
    F5 --> F5i["Payroll Cycle"]
    F5 --> F5j["Payslip"]
    F5 --> F5k["Payroll Calculation Engine"]
    F5 --> F5l["Tax Jurisdiction Engine"]
    F5 --> F5m["Benefits Enrollment"]
    F5 --> F5n["Leave Entitlement Engine"]
    F5 --> F5o["Spending Accounts"]
    F5 --> F5p["Carrier Reconciliation"]

    F6 --> F6a["Goal / OKR"]
    F6 --> F6b["Performance Review"]
    F6 --> F6c["Calibration Session"]
    F6 --> F6d["Performance Improvement Plan"]
    F6 --> F6e["Continuous Feedback"]
    F6 --> F6f["Learning Course"]
    F6 --> F6g["Learning Assignment"]
    F6 --> F6h["Skill Profile"]
    F6 --> F6i["Certification"]
    F6 --> F6j["Career Path"]
    F6 --> F6k["Talent Pool"]
    F6 --> F6l["Succession Plan"]
    F6 --> F6m["Engagement Survey"]
    F6 --> F6n["Recognition Program"]
    F6 --> F6o["360 Feedback"]
    F6 --> F6p["Compensation Plan"]
    F6 --> F6q["Bonus Cycle"]
    F6 --> F6r["Equity Grant"]
    F6 --> F6s["Variable/Commission Plan"]
    F6 --> F6t["Total Comp Statement"]
    F6 --> F6u["Pay Scale / Grade-Step"]
    F6 --> F6v["Learning Content Package"]
    F6 --> F6w["Learning Transcript"]

    F7 --> F7a["Employee Relations Case"]
    F7 --> F7b["Disciplinary Action"]
    F7 --> F7c["Accommodation Case"]
    F7 --> F7d["Policy Acknowledgement"]
    F7 --> F7e["Statutory Report"]
    F7 --> F7f["Work Authorization"]
    F7 --> F7g["HR Knowledge Article"]
    F7 --> F7h["HR Service Catalog"]
    F7 --> F7i["Virtual Agent"]
    F7 --> F7j["Case SLA Management"]

    F8 --> F8a["Country Labor Rule Set"]
    F8 --> F8b["Country Policy Pack"]
    F8 --> F8c["Statutory Leave Type"]
    F8 --> F8d["Works Council"]
    F8 --> F8e["Local Contract Type Rules"]
    F8 --> F8f["Notice Period Rules"]

    F9 --> F9a["Shift Schedule"]
    F9 --> F9b["Open Shift"]
    F9 --> F9c["Shift Bid"]
    F9 --> F9d["Shift Swap"]
    F9 --> F9e["Overtime Approval"]
    F9 --> F9f["Coverage Gap"]
    F9 --> F9g["Schedule Adherence"]

    F10 --> F10a["DEI Report"]
    F10 --> F10b["Pay Gap Report"]
    F10 --> F10c["Pay Equity Audit"]
    F10 --> F10d["Ad-Hoc Reporting"]
    F10 --> F10e["Workforce Planning Plus"]

    F11 --> F11a["Mobile Device Registration"]
    F11 --> F11b["Mobile Offline Package"]
    F11 --> F11c["Mobile Sync"]
    F11 --> F11d["Mobile Clock"]

    F12 --> F12a["EAP Referral"]
    F12 --> F12b["Wellness Program"]
    F12 --> F12c["Wellness Claims"]
    F12 --> F12d["Financial Wellness"]

    F13 --> F13a["Union Contract / CBA"]
    F13 --> F13b["Union Membership"]
    F13 --> F13c["Union Grievance"]
    F13 --> F13d["Labor Action Event"]
    F13 --> F13e["Steward Assignment"]

    F14 --> F14a["AI Use Case Registry"]
    F14 --> F14b["AI Model Run Tracking"]
    F14 --> F14c["AI Bias Testing"]
    F14 --> F14d["Human Review Decisions"]
    F14 --> F14e["AI Kill Switch"]
    F14 --> F14f["AI Safety Findings"]

    style HR fill:#2c3e50,color:#fff,stroke:#1a252f,stroke-width:3px
    style F1 fill:#3498db,color:#fff
    style F2 fill:#3498db,color:#fff
    style F3 fill:#27ae60,color:#fff
    style F4 fill:#e67e22,color:#fff
    style F5 fill:#9b59b6,color:#fff
    style F6 fill:#1abc9c,color:#fff
    style F7 fill:#e74c3c,color:#fff
    style F8 fill:#34495e,color:#fff
    style F9 fill:#16a085,color:#fff
    style F10 fill:#8e44ad,color:#fff
    style F11 fill:#2980b9,color:#fff
    style F12 fill:#27ae60,color:#fff
    style F13 fill:#c0392b,color:#fff
    style F14 fill:#7f8c8d,color:#fff
```

---

## 4. Summary Statistics

### Platform Totals

| Metric | Count |
|--------|-------|
| **Total Module Categories** | 14 |
| **Total Features/Services** | 137 |
| **Total FSMs (State Machines)** | 75+ |
| **Total Tables** | 120+ |
| **Total Policy Engines** | 21 |
| **Total Commands (approximate)** | 400+ |
| **Total Events (approximate)** | 350+ |
| **Authority Domains** | 25+ |
| **Guard Library Items** | 20 |

### Features by Module

| Module | Feature Count | FSMs | Tables | Policy Engines |
|--------|--------------|------|--------|----------------|
| 2.1 HR Platform Foundation | 7 | 1 | 7 | 5 |
| 2.2 Core HR & Organization | 10 | 2 | 12 | 8 |
| 2.3 Talent Acquisition & Onboarding | 19 | 7 | 18 | 9 |
| 2.4 Employment Lifecycle & Service Delivery | 12 | 9 | 12 | 10 |
| 2.5 Time, Attendance, Payroll & Benefits | 23 | 10 | 25 | 10 |
| 2.6 Talent, Learning, Performance & Engagement | 27 | 13 | 25 | 8 |
| 2.7 ER, Compliance & HR Service Delivery | 13 | 10 | 16 | 9 |
| 2.8 Global HR, Localization & Country Policy | 12 | 2 | 12 | 5 |
| 2.9 Workforce Management & Scheduling | 8 | 7 | 8 | 2 |
| 2.10 DEI, People Analytics & Reporting | 10 | 4 | 13 | 4 |
| 2.11 HR Mobile Platform | 5 | 2 | 4 | 3 |
| 2.12 Wellbeing, EAP & Financial Wellness | 5 | 1 | 5 | 3 |
| 2.13 Union & Labor Relations | 6 | 4 | 6 | 3 |
| 2.14 HR AI Governance | 6 | 1 | 6 | 1 |
| **TOTALS** | **163** | **73** | **169** | **80** |

### Version Introduction Distribution

| Version | Features Introduced | Major Additions |
|---------|---------------------|-----------------|
| **V1.0** | 55 | Core HR, Organization, Recruiting, Time & Attendance, Payroll, Benefits, Performance, Learning, ER, Compliance |
| **V1.1** | 46 | Compensation planning, Offboarding/Alumni, WFM/Scheduling, Global HR, Benefits Plus, HR Service Delivery, Workforce Planning, DEI, Engagement, Union, AI Governance |
| **V1.2** | 44 | Payroll Calculation Engine, Tax Jurisdiction, Learning Runtime, Reporting Platform, Contingent Workforce, Absence Entitlement, Candidate Experience, I-9/E-Verify, Pay Scale, HR Mobile, Org Design, Wellbeing/EAP |
| **V1.4** | 18 | Country Policy Pack Governance, Upload/Simulation/Approval/Publication/Rollback, Policy Pack Recalculation Jobs |

### Architectural Governance Metrics

| Metric | Count |
|--------|-------|
| Authority Domains with Owner-Only Mutation | 25+ |
| Universal Guard Library Items | 20 |
| Cross-Blueprint Integration Contracts | 8 (HR/ServiceDesk, HR/CRM, HR/Finance, HR/ITSM, HR/LMS, HR/Payroll, HR/BenefitsCarrier, HR/DataWarehouse) |
| Policy Engine Decision Types | 21 engines x 5-15 outputs each = ~200 decision outputs |
| Field Classification Levels | 5 (LOW, MEDIUM, HIGH, RESTRICTED, SPECIAL_CATEGORY) |
| Command Actor Types | 4 (USER, SYSTEM, SERVICE_ACCOUNT, INTEGRATION) |
| Client Types | 7 (EMPLOYEE_PORTAL, MANAGER_PORTAL, HR_ADMIN, MOBILE, BFF, SYSTEM, INTEGRATION) |

---

## 5. Version Distribution Matrix

| Capability Domain | V1.0 | V1.1 | V1.2 | V1.4 | Total |
|-------------------|:----:|:----:|:----:|:----:|:-----:|
| HR Platform Foundation | X | X | X | X | 7 |
| Worker Profile & Personal Data | X | X | X | | 10 |
| Organization & Position | X | | | | 4 |
| Recruiting & ATS | X | | X | | 10 |
| Onboarding | X | | X | | 2 |
| Employment Contracts | X | | | | 1 |
| Job Assignment & Compensation Change | X | | X | | 3 |
| Offboarding & Alumni | | X | X | | 5 |
| Time & Attendance | X | | X | | 5 |
| Absence & Leave | X | | X | | 4 |
| Payroll Cycle & Input | X | | X | | 3 |
| Payroll Calculation Engine | | | X | | 1 |
| Tax Jurisdiction Engine | | | X | | 1 |
| Benefits Enrollment & Programs | X | X | | | 4 |
| Benefits Administration Plus | | X | | | 5 |
| Leave Entitlement Engine | | | X | | 1 |
| Performance & Goals | X | X | | | 5 |
| Calibration & PIP | X | X | | | 2 |
| Learning Management | X | | X | | 7 |
| Talent & Succession | X | | | | 4 |
| Engagement & Recognition | | X | | | 4 |
| Compensation Planning | | X | | | 5 |
| Pay Scale / Grade-Step | | | X | | 1 |
| ER Case & Disciplinary | X | | | | 3 |
| Accommodation | X | | | | 1 |
| Policy & Compliance | X | X | | X | 5 |
| HR Service Delivery | | X | | | 4 |
| Global HR & Localization | | X | X | X | 8 |
| Country Policy Pack Governance | | | | X | 6 |
| Workforce Management | | X | | | 7 |
| DEI & People Analytics | | X | X | | 6 |
| Reporting Platform | | | X | | 2 |
| HR Mobile Platform | | | X | | 5 |
| Wellbeing & EAP | | | X | | 5 |
| Union & Labor Relations | | X | | | 6 |
| HR AI Governance | | X | | | 6 |
| **TOTAL** | **~55** | **~46** | **~44** | **~18** | **163** |

---

## 6. Cross-Reference Indices

### 6.1 FSM Index

All canonical finite state machines organized by section reference:

| # | FSM Name | Section | States | Version | Module |
|---|----------|---------|--------|---------|--------|
| 1 | WorkerProfile | 6.2 | 9 | V1.0 | Core HR |
| 2 | Position | 6.3 | 8 | V1.0 | Core HR |
| 3 | HeadcountRequest | 6.4 | 8 | V1.0 | Talent Acquisition |
| 4 | JobRequisition | 6.5 | 13 | V1.0 | Talent Acquisition |
| 5 | CandidateApplication | 6.6 | 11 | V1.0 | Talent Acquisition |
| 6 | Offer | 6.7 | 10 | V1.0 | Talent Acquisition |
| 7 | OnboardingPlan | 6.8 | 9 | V1.0 | Talent Acquisition |
| 8 | EmploymentContract | 6.9 | 11 | V1.0 | Employment Lifecycle |
| 9 | JobAssignment | 6.10 | 8 | V1.0 | Employment Lifecycle |
| 10 | AbsenceRequest | 6.11 | 9 | V1.0 | Time & Attendance |
| 11 | LeaveCase | 6.12 | 13 | V1.0 | Time & Attendance |
| 12 | Timesheet | 6.13 | 9 | V1.0 | Time & Attendance |
| 13 | PayrollCycle | 6.14 | 13 | V1.0 | Payroll |
| 14 | CompensationChange | 6.15 | 10 | V1.0 | Compensation |
| 15 | BenefitsEnrollment | 6.16 | 13 | V1.0 | Benefits |
| 16 | PerformanceReviewCycle | 6.17 | 13 | V1.0 | Performance |
| 17 | Goal | 6.18 | 6 | V1.0 | Performance |
| 18 | LearningAssignment | 6.19 | 7 | V1.0 | Learning |
| 19 | SkillProfile | 6.20 | 7 | V1.0 | Skills |
| 20 | SuccessionPlan | 6.21 | 9 | V1.0 | Talent |
| 21 | HRServiceCase | 6.22 | 13 | V1.1 | HR Service Delivery |
| 22 | EmployeeRelationsCase | 6.23 | 11 | V1.0 | Employee Relations |
| 23 | DisciplinaryAction | 6.24 | 11 | V1.0 | Employee Relations |
| 24 | AccommodationCase | 6.25 | 11 | V1.0 | Employee Relations |
| 25 | PolicyAcknowledgement | 6.26 | 8 | V1.0 | Compliance |
| 26 | EngagementSurvey | 6.27 | 11 | V1.0 | Engagement |
| 27 | CompensationPlan | 6.28 | 9 | V1.1 | Compensation |
| 28 | BonusCycle | 6.29 | 11 | V1.1 | Compensation |
| 29 | EquityGrant | 6.30 | 10 | V1.1 | Compensation |
| 30 | VariableCompPlan | 6.31 | 10 | V1.1 | Compensation |
| 31 | TotalCompensationStatement | 6.32 | 10 | V1.1 | Compensation |
| 32 | CompensationBandMarket | 6.33 | 6 | V1.1 | Compensation |
| 33 | OffboardingPlan | 6.34 | 14 | V1.1 | Offboarding |
| 34 | ExitInterview | 6.35 | 7 | V1.1 | Offboarding |
| 35 | FinalSettlement | 6.36 | 10 | V1.1 | Offboarding |
| 36 | ReferenceRequest | 6.37 | 9 | V1.1 | Offboarding |
| 37 | AlumniPortalAccount | 6.38 | 6 | V1.1 | Offboarding |
| 38 | ShiftSchedule | 6.39 | 10 | V1.1 | WFM |
| 39 | OpenShift | 6.40 | 7 | V1.1 | WFM |
| 40 | ShiftBid | 6.41 | 6 | V1.1 | WFM |
| 41 | ShiftSwapRequest | 6.42 | 9 | V1.1 | WFM |
| 42 | OvertimeApproval | 6.43 | 8 | V1.1 | WFM |
| 43 | CoverageGap | 6.44 | 7 | V1.1 | WFM |
| 44 | ScheduleAdherence | 6.45 | 10 | V1.1 | WFM |
| 45 | CountryPolicyPack | 6.46 | 22 | V1.4 | Global HR |
| 46 | WorkAuthorizationCase | 6.47 | 11 | V1.0 | Compliance |
| 47 | StatutoryReport | 6.48 | 10 | V1.0 | Compliance |
| 48 | WorksCouncilConsultation | 6.49 | 9 | V1.1 | Union/Labor |
| 49 | BenefitsOpenEnrollment | 6.50 | 10 | V1.1 | Benefits |
| 50 | DependentEligibilityVerification | 6.51 | 7 | V1.1 | Benefits |
| 51 | BenefitsContinuationCase | 6.52 | 10 | V1.1 | Benefits |
| 52 | SpendingAccount | 6.53 | 8 | V1.1 | Benefits |
| 53 | CarrierReconciliationRun | 6.54 | 7 | V1.1 | Benefits |
| 54 | WellnessProgram | 6.55 | 8 | V1.1 | Wellbeing |
| 55 | BenefitsComparisonSession | 6.56 | 6 | V1.1 | Benefits |
| 56 | HrKnowledgeArticle | 6.57 | 8 | V1.1 | HR Service Delivery |
| 57 | HrServiceCatalogItem | 6.58 | 6 | V1.1 | HR Service Delivery |
| 58 | HrVirtualAgentSession | 6.59 | 9 | V1.1 | HR Service Delivery |
| 59 | HrCaseSlaInstance | 6.60 | 8 | V1.1 | HR Service Delivery |
| 60 | EmployeeLifeEvent | 6.61 | 11 | V1.1 | Employment Lifecycle |
| 61 | ManagerActionRequest | 6.62 | 10 | V1.1 | Manager Self-Service |
| 62 | WorkforceScenario | 6.63 | 7 | V1.1 | Workforce Planning |
| 63 | SkillsGapAnalysis | 6.64 | 8 | V1.1 | Workforce Planning |
| 64 | FteBudgetReconciliation | 6.65 | 7 | V1.1 | Workforce Planning |
| 65 | DeiReport | 6.66 | 10 | V1.1 | DEI/Analytics |
| 66 | PayGapReport | 6.67 | 9 | V1.1 | DEI/Analytics |
| 67 | PayEquityAudit | 6.68 | 10 | V1.1 | DEI/Analytics |
| 68 | Feedback360Cycle | 6.69 | 7 | V1.1 | Engagement |
| 69 | RecognitionRecord | 6.70 | 7 | V1.1 | Engagement |
| 70 | RecognitionProgram | 6.71 | 6 | V1.1 | Engagement |
| 71 | UnionContract | 6.72 | 8 | V1.1 | Union/Labor |
| 72 | UnionGrievance | 6.73 | 10 | V1.1 | Union/Labor |
| 73 | LaborActionEvent | 6.74 | 7 | V1.1 | Union/Labor |
| 74 | HrAiUseCase | 6.75 | 11 | V1.1 | AI Governance |
| 75 | PayrollCalculationRun | 6.89.1 | 11 | V1.2 | Payroll |
| 76 | TaxJurisdictionAssignment | 6.89.2 | 7 | V1.2 | Payroll Tax |
| 77 | LearningContentPackage | 6.89.3 | 7 | V1.2 | Learning |
| 78 | ReportDefinition | 6.89.4 | 8 | V1.2 | Reporting |
| 79 | ContingentWorkerAssignment | 6.89.5 | 9 | V1.2 | Contingent Workforce |
| 80 | LeaveEntitlementCalculation | 6.89.6 | 8 | V1.2 | Absence |
| 81 | CandidateExperienceSession | 6.89.7 | 10 | V1.2 | Candidate Experience |
| 82 | I9Case | 6.89.8 | 13 | V1.2 | Employment Eligibility |
| 83 | PayScale/StepProgression | 6.89.9 | 10 | V1.2 | Compensation |
| 84 | HR Mobile Device/Offline | 6.89.10 | 12 | V1.2 | HR Mobile |
| 85 | OrgDesignScenario | 6.89.11 | 8 | V1.2 | Org Design |
| 86 | Wellbeing/EAP | 6.89.12 | 11 | V1.2 | Wellbeing |

**FSM Total: 86 canonical state machines**

---

### 6.2 Table Index

All canonical tables organized by domain:

#### Core HR & Organization
| Table | Authority | Version |
|-------|-----------|---------|
| `hr_workers` | HR Core | V1.0 |
| `hr_personal_data_records` | HR Core / Privacy | V1.0 |
| `hr_employment_relationships` | HR Core | V1.0 |
| `hr_job_assignments` | HR Core | V1.0 |
| `hr_employment_contracts` | HR Core / Legal HR | V1.0 |
| `hr_worker_documents` | HR Document Platform | V1.0 |
| `org_legal_entities` | Organization Management | V1.0 |
| `org_units` | Organization Management | V1.0 |
| `org_positions` | Position Management | V1.0 |
| `org_manager_relationships` | Organization Management | V1.0 |
| `job_profiles` | Job Architecture | V1.0 |
| `job_families` | Job Architecture | V1.0 |
| `job_grades` | Job Architecture | V1.0 |
| `competency_models` | Skills/Talent | V1.0 |
| `hr_probation_records` | HR Core / Performance | V1.1 |

#### Recruiting & Onboarding
| Table | Authority | Version |
|-------|-----------|---------|
| `workforce_plans` | Workforce Planning | V1.0 |
| `headcount_requests` | Position Control | V1.0 |
| `job_requisitions` | Recruiting | V1.0 |
| `requisition_postings` | Recruiting | V1.0 |
| `candidates` | Recruiting | V1.0 |
| `candidate_applications` | Recruiting | V1.0 |
| `candidate_consents` | Recruiting/Privacy | V1.0 |
| `interview_plans` | Recruiting | V1.0 |
| `interview_events` | Recruiting | V1.0 |
| `assessment_results` | Recruiting / Assessment | V1.0 |
| `background_check_cases` | Recruiting / Compliance | V1.0 |
| `offers` | Recruiting | V1.0 |
| `offer_approvals` | Recruiting / Approval | V1.0 |
| `onboarding_plans` | Onboarding | V1.0 |
| `onboarding_tasks` | Onboarding | V1.0 |
| `career_site_pages` | Candidate Experience | V1.2 |
| `career_site_job_posts` | Candidate Experience | V1.2 |
| `interview_self_schedule_slots` | Candidate Experience | V1.2 |
| `candidate_communications` | Candidate Experience | V1.2 |
| `candidate_referrals` | Candidate Experience | V1.2 |
| `video_interview_sessions` | Candidate Experience | V1.2 |
| `i9_cases` | Employment Eligibility | V1.2 |
| `i9_document_reviews` | Employment Eligibility | V1.2 |
| `everify_cases` | Employment Eligibility | V1.2 |

#### Time, Absence, Payroll & Benefits
| Table | Authority | Version |
|-------|-----------|---------|
| `work_schedules` | Time and Attendance | V1.0 |
| `time_clock_events` | Time and Attendance | V1.0 |
| `timesheets` | Time and Attendance | V1.0 |
| `timesheet_entries` | Time and Attendance | V1.0 |
| `attendance_exceptions` | Time and Attendance | V1.0 |
| `absence_requests` | Absence Management | V1.0 |
| `leave_cases` | Leave Management | V1.0 |
| `absence_accrual_balances` | Absence Management | V1.0 |
| `payroll_inputs` | Payroll | V1.0 |
| `payroll_cycles` | Payroll | V1.0 |
| `payroll_validation_results` | Payroll | V1.0 |
| `payroll_export_batches` | Payroll | V1.0 |
| `payslip_metadata` | Payroll | V1.0 |
| `benefits_programs` | Benefits | V1.0 |
| `benefits_enrollments` | Benefits | V1.0 |
| `benefits_life_events` | Benefits | V1.0 |
| `compensation_plans` | Compensation | V1.1 |
| `compensation_plan_cycles` | Compensation | V1.1 |
| `compensation_bands` | Compensation | V1.0 |
| `compensation_changes` | Compensation | V1.0 |
| `pay_equity_reviews` | Compensation / DEI | V1.1 |
| `bonus_cycles` | Compensation | V1.1 |
| `bonus_recommendations` | Compensation | V1.1 |
| `equity_grants` | Equity/Compensation | V1.1 |
| `equity_vesting_events` | Equity/Compensation | V1.1 |
| `variable_comp_plans` | Compensation | V1.1 |
| `commission_attainment_records` | Compensation | V1.1 |
| `total_compensation_statements` | Compensation | V1.1 |
| `payroll_calculation_runs` | Payroll Calculation | V1.2 |
| `payroll_result_lines` | Payroll Calculation | V1.2 |
| `payroll_rule_sets` | Payroll Calculation | V1.2 |
| `payroll_retro_calculations` | Payroll Calculation | V1.2 |
| `payroll_tax_jurisdiction_assignments` | Payroll Tax | V1.2 |
| `worker_tax_profiles` | Payroll Tax | V1.2 |
| `tax_authority_filings` | Payroll Tax / Compliance | V1.2 |
| `year_end_forms` | Payroll Tax / Document | V1.2 |
| `leave_entitlement_calculations` | Absence Entitlement | V1.2 |
| `leave_balance_projections` | Absence Entitlement | V1.2 |
| `leave_liability_records` | Absence Entitlement / Finance | V1.2 |
| `public_holiday_calendars` | Global HR / Absence | V1.2 |
| `benefits_open_enrollments` | Benefits | V1.1 |
| `dependent_eligibility_verifications` | Benefits | V1.1 |
| `benefits_continuation_cases` | Benefits | V1.1 |
| `spending_accounts` | Benefits | V1.1 |
| `carrier_reconciliation_runs` | Benefits | V1.1 |
| `carrier_reconciliation_mismatches` | Benefits | V1.1 |
| `wellness_programs` | Benefits/Engagement | V1.1 |
| `benefits_comparison_sessions` | Benefits | V1.1 |

#### Talent, Performance, Learning, Engagement
| Table | Authority | Version |
|-------|-----------|---------|
| `performance_review_cycles` | Performance | V1.0 |
| `performance_reviews` | Performance | V1.0 |
| `review_feedback_items` | Performance | V1.0 |
| `goals` | Performance | V1.0 |
| `calibration_sessions` | Performance / Compensation | V1.0 |
| `performance_improvement_plans` | Performance / ER | V1.0 |
| `learning_courses` | Learning | V1.0 |
| `learning_assignments` | Learning | V1.0 |
| `skill_profiles` | Skills/Talent | V1.0 |
| `skill_evidence` | Skills/Talent | V1.0 |
| `certifications` | Learning/Compliance | V1.0 |
| `career_paths` | Talent | V1.0 |
| `talent_pools` | Talent Management | V1.0 |
| `talent_pool_memberships` | Talent Management | V1.0 |
| `succession_plans` | Talent Management | V1.0 |
| `succession_candidates` | Talent Management | V1.0 |
| `engagement_surveys` | Engagement | V1.0 |
| `engagement_survey_responses` | Engagement | V1.0 |
| `engagement_action_plans` | Engagement | V1.0 |
| `recognition_programs` | Engagement | V1.1 |
| `recognition_records` | Engagement | V1.1 |
| `recognition_points_ledger` | Engagement | V1.1 |
| `milestone_recognition_events` | Engagement | V1.1 |
| `feedback_360_cycles` | Engagement / Performance | V1.1 |
| `feedback_360_responses` | Engagement / Performance | V1.1 |
| `salary_market_data` | Compensation | V1.1 |
| `pay_scales` | Compensation | V1.2 |
| `step_progression_batches` | Compensation | V1.2 |
| `step_progression_items` | Compensation | V1.2 |
| `learning_content_packages` | Learning Delivery | V1.2 |
| `learning_delivery_sessions` | Learning Delivery | V1.2 |
| `learning_xapi_statements` | Learning Delivery | V1.2 |
| `assessment_attempts` | Learning Delivery | V1.2 |
| `ilt_events` | Learning Delivery | V1.2 |
| `learning_transcripts` | Learning Delivery | V1.2 |

#### Employee Relations, Compliance, HR Service Delivery
| Table | Authority | Version |
|-------|-----------|---------|
| `hr_service_cases` | HR Service Delivery | V1.1 |
| `hr_case_tasks` | HR Service Delivery | V1.1 |
| `employee_relations_cases` | Employee Relations | V1.0 |
| `er_investigations` | Employee Relations | V1.0 |
| `disciplinary_actions` | Employee Relations | V1.0 |
| `accommodation_cases` | Employee Relations / Compliance | V1.0 |
| `policy_documents` | Compliance / Document | V1.0 |
| `policy_acknowledgements` | Compliance | V1.0 |
| `statutory_reports` | Compliance | V1.0 |
| `work_authorization_cases` | Compliance / Immigration | V1.0 |
| `labor_law_rules` | Compliance | V1.0 |
| `employee_data_subject_requests` | Privacy | V1.0 |
| `hr_legal_holds` | Legal / Compliance | V1.0 |
| `hr_audit_access_logs` | Audit / Privacy | V1.0 |
| `hr_service_catalog_items` | HR Service Delivery | V1.1 |
| `hr_knowledge_articles` | HR Service Delivery | V1.1 |
| `hr_knowledge_article_versions` | HR Service Delivery | V1.1 |
| `hr_virtual_agent_sessions` | HR Service Delivery | V1.1 |
| `hr_case_sla_instances` | HR Service Delivery | V1.1 |
| `hr_deflection_attempts` | HR Service Delivery | V1.1 |
| `employee_life_events` | Employee Self-Service | V1.1 |
| `self_service_requests` | Employee Self-Service | V1.1 |
| `manager_action_requests` | Manager Self-Service | V1.1 |
| `payslip_access_logs` | Payroll / Privacy | V1.1 |

#### Global HR, Localization & Country Policy
| Table | Authority | Version |
|-------|-----------|---------|
| `global_country_rule_sets` | Global HR Compliance | V1.1 |
| `statutory_leave_types` | Global HR Compliance | V1.1 |
| `local_contract_type_rules` | Global HR Compliance | V1.1 |
| `notice_period_rules` | Global HR Compliance | V1.1 |
| `works_council_consultations` | Labor Relations | V1.1 |
| `government_filing_events` | HR Compliance | V1.1 |
| `country_policy_packs` | Global HR / Country Policy | V1.4 |
| `country_policy_pack_sections` | Country Policy Governance | V1.4 |
| `country_policy_uploads` | Country Policy Governance | V1.4 |
| `country_policy_validation_runs` | Country Policy Governance | V1.4 |
| `country_policy_impact_simulations` | Country Policy Governance | V1.4 |
| `country_policy_approval_steps` | Approval / Country Policy | V1.4 |
| `country_policy_publications` | Country Policy Governance | V1.4 |
| `country_policy_recalculation_jobs` | Country Policy / Reconciliation | V1.4 |
| `country_policy_source_evidence` | Legal / Global HR | V1.4 |

#### Workforce Management & Scheduling
| Table | Authority | Version |
|-------|-----------|---------|
| `shift_schedules` | Workforce Management | V1.1 |
| `shift_assignments` | Workforce Management | V1.1 |
| `open_shifts` | Workforce Management | V1.1 |
| `shift_bids` | Workforce Management | V1.1 |
| `shift_swap_requests` | Workforce Management | V1.1 |
| `overtime_approvals` | Workforce Management | V1.1 |
| `coverage_gap_events` | Workforce Management | V1.1 |
| `schedule_adherence_records` | Workforce Management | V1.1 |
| `mobile_clock_events` | Time / HR Mobile | V1.2 |

#### Workforce Planning, DEI, Reporting
| Table | Authority | Version |
|-------|-----------|---------|
| `workforce_scenarios` | Workforce Planning | V1.1 |
| `workforce_demand_lines` | Workforce Planning | V1.1 |
| `workforce_supply_snapshots` | Workforce Planning | V1.1 |
| `skills_gap_analyses` | Workforce Planning | V1.1 |
| `fte_budget_reconciliations` | Workforce Planning | V1.1 |
| `contingent_workforce_plans` | Workforce Planning | V1.1 |
| `dei_reports` | People Analytics | V1.1 |
| `pay_gap_reports` | People Analytics | V1.1 |
| `promotion_equity_reports` | People Analytics | V1.1 |
| `attrition_segment_reports` | People Analytics | V1.1 |
| `manager_diversity_reports` | People Analytics | V1.1 |
| `analytics_suppression_logs` | People Analytics | V1.1 |
| `report_definitions` | Reporting Platform | V1.2 |
| `report_executions` | Reporting Platform | V1.2 |
| `calculated_fields` | Reporting Platform | V1.2 |
| `report_schedules` | Reporting Platform | V1.2 |
| `warehouse_export_jobs` | Reporting / Data | V1.2 |

#### Contingent Workforce
| Table | Authority | Version |
|-------|-----------|---------|
| `contingent_worker_assignments` | Contingent Workforce | V1.2 |
| `sow_engagements` | Contingent Workforce | V1.2 |
| `contractor_rate_cards` | Contingent Workforce | V1.2 |
| `vms_integration_mappings` | Contingent Workforce | V1.2 |
| `misclassification_assessments` | Compliance / Contingent | V1.2 |

#### HR Mobile Platform
| Table | Authority | Version |
|-------|-----------|---------|
| `hr_mobile_devices` | HR Mobile Platform | V1.2 |
| `hr_mobile_offline_packages` | HR Mobile Platform | V1.2 |
| `hr_mobile_sync_batches` | HR Mobile Platform | V1.2 |

#### Org Design
| Table | Authority | Version |
|-------|-----------|---------|
| `org_design_scenarios` | Org Design Studio | V1.2 |
| `org_design_scenario_nodes` | Org Design Studio | V1.2 |
| `rif_scenarios` | Org Design / Workforce | V1.2 |

#### Union & Labor Relations
| Table | Authority | Version |
|-------|-----------|---------|
| `union_contracts` | Labor Relations | V1.1 |
| `union_contract_rules` | Labor Relations | V1.1 |
| `union_memberships` | Labor Relations | V1.1 |
| `union_grievances` | Labor Relations | V1.1 |
| `labor_action_events` | Labor Relations | V1.1 |
| `steward_assignments` | Labor Relations | V1.1 |

#### HR AI Governance
| Table | Authority | Version |
|-------|-----------|---------|
| `hr_ai_use_cases` | HR AI Governance | V1.1 |
| `hr_ai_model_runs` | HR AI Governance | V1.1 |
| `hr_ai_bias_tests` | HR AI Governance | V1.1 |
| `hr_ai_safety_findings` | HR AI Governance | V1.1 |
| `hr_ai_kill_switches` | HR AI Governance | V1.1 |
| `hr_ai_human_review_decisions` | HR AI Governance | V1.1 |

#### Wellbeing
| Table | Authority | Version |
|-------|-----------|---------|
| `eap_referrals` | Wellbeing / EAP | V1.2 |
| `wellness_claims` | Wellbeing | V1.2 |
| `financial_wellness_requests` | Wellbeing / Payroll | V1.2 |
| `eap_anonymous_usage_rollups` | Wellbeing / Analytics | V1.2 |

**Table Total: 120+ canonical tables**

---

### 6.3 Policy Engine Index

| # | Engine Name | Section | Outputs | Version | Domains Served |
|---|-------------|---------|---------|---------|----------------|
| 1 | Employment Eligibility | 7.1 | 11 decision outputs | V1.0 | Worker activation, onboarding, I-9, contract |
| 2 | Position & Headcount | 7.2 | 7 decision outputs | V1.0 | Recruiting, position control, workforce planning |
| 3 | Recruiting Fairness | 7.3 | 8 decision outputs | V1.0 | Job posting, candidate advance, offer |
| 4 | Offer & Compensation | 7.4 | 6 decision outputs | V1.0 | Offer approval, compensation review |
| 5 | Time, Absence & Leave | 7.5 | 8 decision outputs | V1.0 | Absence approval, leave documentation |
| 6 | Payroll Validation | 7.6 | 8 decision outputs | V1.0 | Payroll input validation, cycle readiness |
| 7 | Performance & Calibration | 7.7 | 6 decision outputs | V1.0 | Review readiness, calibration, promotion |
| 8 | ER & Disciplinary | 7.8 | 8 decision outputs | V1.0 | Case review, disciplinary action, works council |
| 9 | Talent & Succession | 7.9 | 7 decision outputs | V1.0 | Successor readiness, retention, mobility |
| 10 | HR Privacy & Visibility | 7.10 | 7 decision outputs | V1.0 | Field access, masking, step-up, break-glass |
| 11 | Compensation/Equity/Total Rewards | 7.11 | 11 decision outputs | V1.1 | Comp planning, bonus, equity, total comp |
| 12 | Workforce Mgmt Scheduling | 7.12 | 7 decision outputs | V1.1 | Shift scheduling, overtime, coverage |
| 13 | Global Labor-Law Localization | 7.13 | 7 decision outputs | V1.1 | Country rules, works council, statutory reports |
| 14 | Benefits | 7.14 | 8 decision outputs | V1.1 | Eligibility, enrollment, continuation, spending |
| 15 | HR Service Delivery | 7.15 | 7 decision outputs | V1.1 | Case routing, SLA, self-service, deflection |
| 16 | Self-Service Authority | 7.16 | Allowlist governance | V1.1 | Employee/manager command authorization |
| 17 | Workforce Planning | 7.17 | 6 decision outputs | V1.1 | Scenario modeling, headcount, skills gap |
| 18 | DEI/Pay Transparency/Analytics | 7.18 | 6 decision outputs | V1.1 | Report approval, small-cell suppression |
| 19 | Engagement/Recognition/360 | 7.19 | 6 decision outputs | V1.1 | Survey anonymity, recognition moderation |
| 20 | Union/Works-Council/Labor | 7.20 | 6 decision outputs | V1.1 | CBA rules, grievance deadlines, consultation |
| 21 | HR AI Governance | 7.21 | 6 decision outputs | V1.1 | AI use case risk, bias testing, human oversight |
| 22 | Payroll Calculation | 7.21 | 9 decision outputs | V1.2 | Gross-to-net calculation, retro, explainability |
| 23 | Tax Jurisdiction | 7.22 | 5 decision outputs | V1.2 | Jurisdiction assignment, reciprocity, nexus |
| 24 | Absence Entitlement | 7.23 | 7 decision outputs | V1.2 | Leave calculation, projection, carryover, payout |
| 25 | Learning Delivery | 7.24 | 8 decision outputs | V1.2 | SCORM/xAPI, assessment, certification, transcript |
| 26 | Reporting/Analytics | 7.25 | 8 decision outputs | V1.2 | Report approval, field policy, export, suppression |
| 27 | Contingent Workforce | 7.26 | 4 decision outputs | V1.2 | Assignment, compliance, misclassification |
| 28 | Candidate Experience | 7.27 | 6 decision outputs | V1.2 | Career site, self-scheduling, referral, I-9 |
| 29 | Grade-Step/Position-Based Comp | 7.28 | 5 decision outputs | V1.2 | Step eligibility, progression, longevity |
| 30 | Organization Design/RIF | 7.29 | 4 decision outputs | V1.2 | Scenario simulation, legal review, works council |
| 31 | Wellbeing/EAP Privacy | 7.30 | Privacy rules | V1.2 | EAP anonymity, crisis escalation, financial wellness |

**Policy Engine Total: 31 canonical decision engines**

---

## 7. Key Architectural Principles

```text
1. ONE OWNER: Every HR business concept has exactly one authoritative owner.
2. COMMAND-ONLY MUTATION: No module may directly mutate another domain's tables.
3. EVENT-DRIVEN OBSERVATION: Modules observe via the canonical event nervous system.
4. FSM-GOVERNED LIFECYCLES: Every meaningful lifecycle is governed by a canonical state machine.
5. POLICY-ENGINE DECISIONS: Business brain produces explainable, versioned decisions.
6. FIELD-LEVEL PRIVACY: All data access respects field classification and special-category rules.
7. TENANT-ISOLATED: Every query and command is scoped to a tenant.
8. IDEMPOTENT: All commands carry idempotency keys.
9. AUDIT-TRAIL: Every state change writes an authoritative audit record.
10. OUTBOX/INBOX: Events are published through the outbox pattern for guaranteed delivery.
11. COUNTRY POLICY PACKS: All jurisdiction-specific values flow through uploaded, validated,
    simulated, approved, published, versioned, immutable country policy packs.
12. AI GOVERNANCE: AI remains advisory; human oversight owns HR truth.
```

---

*End of Enterprise HR/HCM Platform — Full Feature Depth Chart*
*Generated from Master Blueprint v1.4*
