# Scheduler And Automation Catalog

This catalog documents the platform scheduler implemented in `apps/hr-api/src/platform/scheduler`.

## Runtime Contract

- The scheduler runs through `JobRunner` once per minute and evaluates each job cron in the active tenant timezone returned by `TenantDirectoryService`.
- Every tenant run executes inside tenant context and uses the `SYSTEM_SCHEDULER` actor from `SystemActorFactory`.
- Mutating jobs dispatch commands through `CommandBus.execute()` with `metadata.clientType = SYSTEM_SCHEDULER`, job name as the command reason, and a scheduler idempotency key.
- Reminder jobs publish a `ReminderDue` domain event through `ReminderEmitter`; they do not write notifications directly.
- Reminder de-duplication is stored in `hr_platform.reminder_dispatch_log`.
- Tenant schedule overrides live in `hr_platform.scheduler_job_schedules`; disabled jobs are recorded as skipped.
- Run records live in `hr_platform.scheduler_job_runs`.

## Run Ledger And Idempotency

`scheduler_job_runs` is constrained by `UNIQUE(tenant_id, job_name, period_key)`. `SchedulerJobRunRepository.tryStartRun()` inserts a `RUNNING` row for the tenant/job/period. If the row already exists, the run is not acquired and the runner returns `SKIPPED`; a previously successful run reports `ALREADY_SUCCEEDED`, and any other existing run reports `RUNNING`.

That means one scheduler period can have only one ledger row per tenant and job. A forced double-run for the same tenant, job, and period does not process work twice.

Verified by `apps/hr-api/src/platform/scheduler/job-runner.service.test.ts`:

- `skips a second run with the same tenant/job/period key`
- `does not double-process concurrent runners for the same tenant/job/period`

## Escalation Codes

Reminder jobs use `escalationTier(offsetDays, escalateToManager)`:

- `T_MINUS_N`: N days before due.
- `T_ZERO`: due now.
- `T_PLUS_N`: N days overdue.
- `escalateToManager = true`: the reminder payload includes a manager escalation audience when the due record has manager context.

Rows below list the source of the escalation. Exact day offsets come from each due row, policy, cutoff, or date threshold.

## Job Catalog

All cron expressions are evaluated in the tenant timezone. `tenant-local tick bucket` means the default `schedulerPeriodKey(now, tenant.timezone)` is used for idempotency.

| Job | Default cron | Trigger condition | Command or event emitted | Period key | Escalation tiers | System actor permission |
| --- | --- | --- | --- | --- | --- | --- |
| `leave-accrual-run` | `0 2 * * *` | `findActiveAccrualBalances` returns active balances due for accrual. | `UpdateAbsenceAccrualBalance` | `YYYY-MM` | None. | `LEAVE_BALANCE_UPDATE` |
| `leave-carryover-run` | `0 3 31 12 *` | `findCarryoverBalances` returns balances due for year-end carryover. | `CarryOverAbsenceAccrualBalance` | `YYYY` | None. | `LEAVE_BALANCE_UPDATE` |
| `leave-balance-expiry-alert` | `0 9 * * 1` | `findBalanceAlerts` returns expiring or negative leave balances. | `ReminderDue(LEAVE_BALANCE_ALERT)` | tenant-local tick bucket | Expiring balances use `T_MINUS_7`; negative balances use `T_ZERO` and manager escalation. | `SCHEDULER_RUN` |
| `leave-approval-sla` | `0 8 * * *` | `findApprovalSlaBreaches` returns pending leave approvals past policy SLA. | `ReminderDue(LEAVE_APPROVAL_SLA)` | tenant-local tick bucket | `T_PLUS_N` by overdue days, with manager escalation when overdue. | `SCHEDULER_RUN` |
| `return-to-work-reminder` | `0 9 * * *` | `findUpcomingReturnToWorkCases` returns leave cases near planned return. | `ReminderDue(RETURN_TO_WORK_REMINDER)` | tenant-local tick bucket | `T_MINUS_1`. | `SCHEDULER_RUN` |
| `attendance-daily-finalization` | `0 20 * * *` | `findFinalizationTargets` returns prior business day ledgers to finalize. | `FinalizeAttendanceDailyLedger` | previous tenant-local `YYYY-MM-DD` | None. | `ATTENDANCE_LEDGER_FINALIZE` |
| `timesheet-submission-reminder` | `0 10 * * *` | `findUnsubmittedTimesheets` returns workers with unsubmitted timesheets. | `ReminderDue(TIMESHEET_SUBMISSION_REMINDER)` | tenant-local tick bucket | `T_MINUS_1`. | `SCHEDULER_RUN` |
| `timesheet-approval-sla` | `0 8 * * *` | `findTimesheetApprovalSlaBreaches` returns submitted timesheets pending approval past SLA. | `ReminderDue(TIMESHEET_APPROVAL_SLA)` | tenant-local tick bucket | `T_PLUS_N` by overdue days, with manager escalation when overdue. | `SCHEDULER_RUN` |
| `attendance-anomaly-alert` | `0 7 * * *` | `findAttendanceAnomalies` returns missing punch, overtime, or exception anomalies for prior day. | `ReminderDue(ATTENDANCE_ANOMALY_ALERT)` | previous tenant-local `YYYY-MM-DD` | `T_ZERO`; critical anomalies escalate to manager. | `SCHEDULER_RUN` |
| `payroll-cycle-open` | `0 6 * * *` | `findCyclesToOpen` returns pay periods that should have a draft cycle. | `CreatePayrollCycle` | `YYYY-MM` | None. | `PAYROLL_CYCLE_CREATE` |
| `payroll-cutoff-reminder` | `0 9 * * *` | `findCutoffReminderItems` returns cycles with unfinished inputs at T-3, T-1, or cutoff day. | `ReminderDue(PAYROLL_CUTOFF_REMINDER)` | tenant-local tick bucket | `T_MINUS_3`, `T_MINUS_1`, or `T_ZERO`. | `SCHEDULER_RUN` |
| `payroll-readiness-check` | `0 11 * * *` | `findReadinessIssues` returns missing bank, tax, attendance, or input readiness items. | `ReminderDue(PAYROLL_READINESS_CHECK)` | tenant-local tick bucket | `T_ZERO` with payroll-admin escalation. | `SCHEDULER_RUN` |
| `review-cycle-due-reminder` | `0 9 * * *` | `findReviewCyclesDueForReminder` returns performance cycles near due date. | `ReminderDue(PERFORMANCE_REVIEW_CYCLE_DUE)` | tenant-local tick bucket | `T_MINUS_N` by days until due. | `SCHEDULER_RUN` |
| `goal-checkin-cadence` | `0 10 * * 1` | `findGoalCheckinsDue` returns goals requiring periodic check-in. | `ReminderDue(GOAL_CHECKIN_DUE)` | tenant-local tick bucket | `T_PLUS_N` when overdue; manager escalation after due. | `SCHEDULER_RUN` |
| `overdue-review-escalation` | `0 8 * * *` | `findOverduePerformanceReviews` returns overdue performance reviews. | `ReminderDue(PERFORMANCE_REVIEW_OVERDUE)` | tenant-local tick bucket | `T_PLUS_N` by overdue days, with manager escalation. | `SCHEDULER_RUN` |
| `probation-review-due` | `0 9 * * *` | `findProbationReviewsDue` returns probation reviews near probation end. | `ReminderDue(PROBATION_REVIEW_DUE)` | tenant-local tick bucket | `T_MINUS_N` by days until probation end. | `SCHEDULER_RUN` |
| `survey-window-activate-close` | `0 6 * * *` | `findSurveysToActivate` and `findSurveysToClose` return effective-dated engagement surveys. | `ActivateEngagementSurvey`, `CloseEngagementSurvey` | tenant-local tick bucket | None. | `SCHEDULER_RUN` |
| `feedback-360-nudge` | `0 9 * * *` | `findFeedback360RaterNudges` returns outstanding 360 rater responses. | `ReminderDue(FEEDBACK_360_RATER_NUDGE)` | tenant-local tick bucket | `T_MINUS_N` until close; manager escalation when close is within 1 day. | `SCHEDULER_RUN` |
| `recognition-program-period-close` | `0 4 * * *` | `findRecognitionProgramsToClose` returns recognition programs past period end. | `CloseRecognitionProgram` | tenant-local tick bucket | None. | `SCHEDULER_RUN` |
| `assignment-due-reminder` | `0 9 * * *` | `findLearningAssignmentsDue` returns learning assignments due or overdue. | `ReminderDue(LEARNING_ASSIGNMENT_DUE)` | tenant-local tick bucket | `T_ZERO` or `T_PLUS_N`; manager escalation when overdue. | `SCHEDULER_RUN` |
| `certification-expiry-reminder` | `0 9 * * *` | `findCertificationsExpiring` returns certifications at T-60, T-30, T-7, or expired. | `ReminderDue(CERTIFICATION_EXPIRY)` | tenant-local tick bucket | `T_MINUS_60`, `T_MINUS_30`, `T_MINUS_7`, or `T_ZERO` with escalation if expired. | `SCHEDULER_RUN` |
| `mandatory-training-deadline` | `0 10 * * *` | `findMandatoryTrainingDeadlines` returns required training due or overdue. | `ReminderDue(MANDATORY_TRAINING_DEADLINE)` | tenant-local tick bucket | `T_ZERO` or `T_PLUS_N`; manager escalation when overdue. | `SCHEDULER_RUN` |
| `stale-requisition-alert` | `0 9 * * 1` | `findStaleRequisitions` returns requisitions open beyond aging thresholds. | `ReminderDue(STALE_REQUISITION_ALERT)` | tenant-local tick bucket | `T_PLUS_N` after 30 days; hiring manager escalation after 45 days. | `SCHEDULER_RUN` |
| `candidate-aging-in-stage` | `0 9 * * *` | `findCandidatesAgingInStage` returns candidates stuck in a pipeline stage. | `ReminderDue(CANDIDATE_AGING_IN_STAGE)` | tenant-local tick bucket | `T_PLUS_N` after 7 days; escalates after 14 days. | `SCHEDULER_RUN` |
| `interview-reminder` | `0 8 * * *` | `findInterviewsDueForReminder` returns interviews approaching start. | `ReminderDue(INTERVIEW_REMINDER)` | tenant-local tick bucket | `T_MINUS_1`. | `SCHEDULER_RUN` |
| `offer-expiry-reminder` | `0 9 * * *` | `findOffersExpiring` returns offers near expiry. | `ReminderDue(OFFER_EXPIRY_REMINDER)` | tenant-local tick bucket | `T_MINUS_N`; escalates at expiry. | `SCHEDULER_RUN` |
| `pre-start-reminders` | `0 9 * * *` | `findPreStartReminders` returns hires approaching start date. | `ReminderDue(ONBOARDING_PRE_START)` | tenant-local tick bucket | `T_MINUS_N` by days until start. | `SCHEDULER_RUN` |
| `onboarding-task-due` | `0 9 * * *` | `findOnboardingTasksDue` returns due, overdue, or stalled onboarding tasks. | `ReminderDue(ONBOARDING_TASK_DUE)` | tenant-local tick bucket | `T_ZERO` or `T_PLUS_N`; escalates when overdue or stalled. | `SCHEDULER_RUN` |
| `day-30-60-90-checkpoints` | `0 9 * * *` | `findOnboardingCheckpointsDue` returns onboarding checkpoints due. | `ReminderDue(ONBOARDING_CHECKPOINT_DUE)` | tenant-local tick bucket | `T_ZERO`. | `SCHEDULER_RUN` |
| `succession-plan-review-cadence` | `0 9 * * 1` | `findSuccessionPlanReviewsDue` returns succession plans requiring review. | `ReminderDue(SUCCESSION_PLAN_REVIEW_DUE)` | tenant-local tick bucket | `T_ZERO`. | `SCHEDULER_RUN` |
| `skill-profile-refresh-nudge` | `0 10 1 * *` | `findSkillProfilesForRefresh` returns skill profiles stale beyond refresh cadence. | `ReminderDue(SKILL_PROFILE_REFRESH)` | tenant-local tick bucket | `T_PLUS_N` after 180 days; manager escalation after 210 days. | `SCHEDULER_RUN` |
| `comp-review-cycle-open` | `0 6 1 1 *` | `findCompReviewCyclesToOpen` returns annual compensation cycles to create. | `CreateBonusCycle` | `YYYY` | None. | `COMPENSATION_CYCLE_CREATE` |
| `pay-equity-periodic-recompute` | `0 7 1 * *` | `findPayEquityReviewsDue` returns pay-equity reviews due for recompute. | `ReminderDue(PAY_EQUITY_RECOMPUTE_DUE)` | tenant-local tick bucket | `T_ZERO` with compensation-admin escalation. | `SCHEDULER_RUN` |
| `policy-acknowledgement-reminder` | `0 9 * * *` | `findPolicyAcknowledgementReminders` returns policy acknowledgements due or overdue. | `ReminderDue(POLICY_ACKNOWLEDGEMENT_DUE)` | tenant-local tick bucket | `T_ZERO` or `T_PLUS_N`; manager escalation when overdue. | `SCHEDULER_RUN` |
| `mandatory-compliance-task-deadline` | `0 10 * * *` | `findMandatoryComplianceTasksDue` returns compliance tasks due or overdue. | `ReminderDue(MANDATORY_COMPLIANCE_TASK_DEADLINE)` | tenant-local tick bucket | `T_ZERO` or `T_PLUS_N`; manager escalation when overdue. | `SCHEDULER_RUN` |
| `document-expiry-alert` | `0 9 * * *` | `findComplianceDocumentsExpiring` returns documents at T-90, T-60, T-30, T-14, T-7, or expiry. | `ReminderDue(COMPLIANCE_DOCUMENT_EXPIRY)` | tenant-local tick bucket | `T_MINUS_90`, `T_MINUS_60`, `T_MINUS_30`, `T_MINUS_14`, `T_MINUS_7`, or `T_ZERO`. | `SCHEDULER_RUN` |
| `probation-period-end` | `0 8 * * *` | `findProbationPeriodsEnding` returns probation records due for completion or reminder. | `CompleteProbationEmploymentRelationship`, `ReminderDue(PROBATION_PERIOD_END)` | tenant-local tick bucket | Command when auto-complete is due; otherwise `T_MINUS_N` reminder to manager. | `EMPLOYMENT_RELATIONSHIP_UPDATE` |
| `contract-term-end-alert` | `0 9 * * *` | `findContractTermsEnding` returns contracts at end-date thresholds. | `ReminderDue(CONTRACT_TERM_END)` | tenant-local tick bucket | `T_MINUS_60`, `T_MINUS_30`, `T_MINUS_14`, `T_MINUS_7`, or `T_ZERO`. | `SCHEDULER_RUN` |
| `work-anniversary` | `0 8 * * *` | `findWorkAnniversaries` returns worker anniversaries for the local day. | `ReminderDue(WORK_ANNIVERSARY)` | tenant-local tick bucket | `T_ZERO`. | `SCHEDULER_RUN` |
| `birthday-events` | `0 8 * * *` | `findBirthdays` returns worker birthdays for the local day. | `ReminderDue(EMPLOYEE_BIRTHDAY)` | tenant-local tick bucket | `T_ZERO`. | `SCHEDULER_RUN` |
| `personal-document-expiry` | `0 9 * * *` | `findPersonalDocumentsExpiring` returns personal documents at expiry thresholds. | `ReminderDue(PERSONAL_DOCUMENT_EXPIRY)` | tenant-local tick bucket | `T_MINUS_90`, `T_MINUS_60`, `T_MINUS_30`, `T_MINUS_14`, `T_MINUS_7`, or `T_ZERO`. | `SCHEDULER_RUN` |
| `immigration-work-permit-expiry` | `0 9 * * *` | `findWorkPermitsExpiring` returns immigration or work-permit expiries. | `ReminderDue(IMMIGRATION_WORK_PERMIT_EXPIRY)` | tenant-local tick bucket | `T_MINUS_90`, `T_MINUS_60`, `T_MINUS_30`, `T_MINUS_14`, `T_MINUS_7`, or `T_ZERO`. | `SCHEDULER_RUN` |
| `international-assignment-end` | `0 9 * * *` | `findInternationalAssignmentsEnding` returns international assignments nearing end. | `ReminderDue(INTERNATIONAL_ASSIGNMENT_END)` | tenant-local tick bucket | `T_MINUS_N` by days until end. | `SCHEDULER_RUN` |
| `access-recertification-campaign` | `0 6 1 * *` | `findAccessRecertificationCampaignsDue` returns access-review campaigns due to create. | `CreateAccessReviewCampaign` | `YYYY-MM` | None. | `ACCESS_REVIEW_MANAGE` |
| `stale-access-review` | `0 9 * * *` | `findStaleAccessReviews` returns access reviews past due. | `ReminderDue(STALE_ACCESS_REVIEW)` | tenant-local tick bucket | `T_PLUS_N` with manager escalation when overdue. | `SCHEDULER_RUN` |
| `break-glass-session-expiry` | `*/15 * * * *` | `findBreakGlassSessionsExpiring` returns privileged sessions near expiry. | `ReminderDue(BREAK_GLASS_SESSION_EXPIRY)` | tenant-local tick bucket | `T_ZERO`. | `SCHEDULER_RUN` |
| `bias-test-cadence-due` | `0 8 * * 1` | `findBiasTestsDue` returns AI use cases with due bias testing. | `ReminderDue(AI_BIAS_TEST_CADENCE_DUE)` | tenant-local tick bucket | `T_ZERO`. | `SCHEDULER_RUN` |
| `use-case-reassessment-due` | `0 8 * * 1` | `findUseCaseReassessmentsDue` returns AI use cases due for reassessment. | `ReminderDue(AI_USE_CASE_REASSESSMENT_DUE)` | tenant-local tick bucket | `T_ZERO`. | `SCHEDULER_RUN` |
| `kill-switch-review` | `0 8 * * *` | `findKillSwitchReviewsDue` returns open AI kill-switch records due for review. | `ReminderDue(AI_KILL_SWITCH_REVIEW)` | tenant-local tick bucket | `T_ZERO`. | `SCHEDULER_RUN` |
| `scheduled-policy-activation` | `0 5 * * *` | `findPoliciesToApply` returns effective-dated policy revisions due to apply. | `ApplyPolicyRevision` | tenant-local tick bucket | None. | `SCHEDULER_RUN` |
| `revision-publishing` | `0 4 * * *` | `findPolicyRevisionsToPublish` returns policy revisions due to publish. | `PublishPolicyRevision` | tenant-local tick bucket | None. | `SCHEDULER_RUN` |
| `CBA-expiry-reminder` | `0 9 * * 1` | `findCbaExpiries` returns collective bargaining agreements at expiry thresholds. | `ReminderDue(CBA_EXPIRY_REMINDER)` | tenant-local tick bucket | `T_MINUS_90`, `T_MINUS_60`, `T_MINUS_30`, `T_MINUS_14`, `T_MINUS_7`, or `T_ZERO`. | `SCHEDULER_RUN` |
| `grievance-SLA-escalation` | `0 9 * * *` | `findGrievanceSlaBreaches` returns grievances past SLA. | `ReminderDue(GRIEVANCE_SLA_ESCALATION)` | tenant-local tick bucket | `T_PLUS_N` with manager escalation when overdue. | `SCHEDULER_RUN` |
| `case-SLA-aging` | `0 9 * * *` | `findCaseSlaAging` returns service or employee-relations cases aging toward breach. | `ReminderDue(CASE_SLA_AGING)` | tenant-local tick bucket | `T_PLUS_N` with manager escalation when overdue. | `SCHEDULER_RUN` |
| `investigation-deadline` | `0 9 * * *` | `findInvestigationDeadlines` returns investigations near or past deadline. | `ReminderDue(INVESTIGATION_DEADLINE)` | tenant-local tick bucket | `T_PLUS_N` with manager escalation when overdue. | `SCHEDULER_RUN` |
| `open-enrollment-window-open` | `0 5 * * *` | `findBenefitsProgramsToOpen` returns benefits programs whose enrollment window starts. | `ActivateBenefitsProgram` | tenant-local tick bucket | None. | `SCHEDULER_RUN` |
| `open-enrollment-window-close` | `0 5 * * *` | `findBenefitsProgramsToClose` returns benefits programs whose enrollment window ends. | `CloseBenefitsProgram` | tenant-local tick bucket | None. | `SCHEDULER_RUN` |
| `life-event-deadline-reminder` | `0 9 * * *` | `findLifeEventDeadlines` returns benefits life events due or overdue. | `ReminderDue(BENEFITS_LIFE_EVENT_DEADLINE)` | tenant-local tick bucket | `T_ZERO` or `T_PLUS_N`; manager escalation when overdue. | `SCHEDULER_RUN` |
| `spending-account-use-it-or-lose-it` | `0 9 * * *` | `findSpendingAccountsUseItOrLoseIt` returns spending accounts at T-60, T-30, T-7, or deadline. | `ReminderDue(SPENDING_ACCOUNT_USE_IT_OR_LOSE_IT)` | tenant-local tick bucket | `T_MINUS_60`, `T_MINUS_30`, `T_MINUS_7`, or `T_ZERO`. | `SCHEDULER_RUN` |
| `position-vacancy-aging` | `0 9 * * 1` | `findAgingVacantPositions` returns vacant positions over aging threshold. | `ReminderDue(POSITION_VACANCY_AGING)` | tenant-local tick bucket | `T_PLUS_N` based on vacancy age. | `SCHEDULER_RUN` |
| `scheduled-position-effective-date-activation` | `0 5 * * *` | `findPositionsToActivate` returns positions whose effective date has arrived. | `ActivatePosition` | tenant-local tick bucket | None. | `SCHEDULER_RUN` |
| `scheduled-reorg-effective-date-activation` | `0 5 * * *` | `findOrgUnitsToRestructure` returns reorg changes whose effective date has arrived. | `RestructureOrgUnit` | tenant-local tick bucket | None. | `SCHEDULER_RUN` |
| `periodic-headcount-snapshot` | `0 2 1 * *` | `findHeadcountSnapshotsDue` returns monthly headcount snapshot definitions due to run. | `RunReportDefinition` | `YYYY-MM` | None. | `SCHEDULER_RUN` |
| `schedule-publish-reminder` | `0 9 * * *` | `findSchedulesNeedingPublish` returns schedules approaching publish deadline. | `ReminderDue(SCHEDULE_PUBLISH_REMINDER)` | tenant-local tick bucket | `T_MINUS_N` by days until shift. | `SCHEDULER_RUN` |
| `coverage-gap-alert` | `0 7 * * *` | `findCoverageGapsForAlert` returns workforce coverage gaps. | `NotifyCoverageGap` | tenant-local tick bucket | None. | `WORKFORCE_COVERAGE_MANAGE` |
| `sow-end-date-reminder` | `0 9 * * *` | `findSowEndDates` returns statements of work nearing end date. | `ReminderDue(SOW_END_DATE_REMINDER)` | tenant-local tick bucket | `T_MINUS_60`, `T_MINUS_30`, `T_MINUS_14`, `T_MINUS_7`, or `T_ZERO`. | `SCHEDULER_RUN` |
| `assignment-expiry` | `0 9 * * *` | `findContingentAssignmentsExpiring` returns contingent assignments nearing end. | `ReminderDue(CONTINGENT_ASSIGNMENT_EXPIRY)` | tenant-local tick bucket | `T_MINUS_N` by days until end. | `SCHEDULER_RUN` |
| `co-employment-tenure-threshold-alert` | `0 9 * * 1` | `findContingentTenureThresholds` returns contingent workers crossing tenure thresholds. | `ReminderDue(CONTINGENT_TENURE_THRESHOLD)` | tenant-local tick bucket | `T_ZERO` threshold alert. | `SCHEDULER_RUN` |
| `rate-card-review-due` | `0 9 * * *` | `findRateCardsForReview` returns rate cards at review thresholds. | `ReminderDue(RATE_CARD_REVIEW_DUE)` | tenant-local tick bucket | `T_MINUS_30`, `T_MINUS_14`, `T_MINUS_7`, or `T_ZERO`. | `SCHEDULER_RUN` |
| `referral-follow-up-reminder` | `0 9 * * *` | `findReferralFollowUps` returns EAP referrals due for follow-up. | `ReminderDue(EAP_REFERRAL_FOLLOW_UP)` | tenant-local tick bucket | `T_ZERO` or `T_PLUS_N`; manager escalation when overdue. | `SCHEDULER_RUN` |
| `wellness-program-enrollment-window` | `0 5 * * *` | `findWellnessProgramsToActivate` returns wellness programs whose enrollment window opens. | `ActivateWellnessProgram` | tenant-local tick bucket | None. | `SCHEDULER_RUN` |
| `scheduled-report-generation` | `*/15 * * * *` | `findReportSchedulesDue` returns scheduled reports due for generation and delivery. | `RunReportDefinition`, `ReminderDue(SCHEDULED_REPORT_DELIVERY)` | tenant-local tick bucket | Delivery reminder after successful report run. | `SCHEDULER_RUN` |
| `periodic-metric-snapshot` | `0 3 1 * *` | `findMetricSnapshotsDue` returns metric snapshots due for the monthly period. | `RunReportDefinition` | `YYYY-MM` | None. | `SCHEDULER_RUN` |

## Operator Checks

- Run history: `GET /api/v1/platform/scheduler/jobs` returns each registered job, its default cron, tenant override, last run, and enabled state.
- Manual run: `POST /api/v1/platform/scheduler/jobs/:name/run` executes the same runner path and ledger rules as cron ticks.
- Retune or disable: `PATCH /api/v1/platform/scheduler/jobs/:name/schedule` writes `scheduler_job_schedules`.
- Metrics: `ObservabilityMetricsService.recordSchedulerJobRun()` records run count, duration, and item count by status.
- Logs: every tenant job result emits structured `SCHEDULER_JOB_RUN` entries with tenant, job, period key, status, duration, items processed, and error or skip reason.
