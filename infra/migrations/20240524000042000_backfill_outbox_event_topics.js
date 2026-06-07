const KNOWN_TOPICS = [
  'hr.core.v1',
  'hr.recruiting.v1',
  'hr.onboarding.v1',
  'hr.compensation.v1',
  'hr.time.v1',
  'hr.absence.v1',
  'hr.payroll.v1',
  'hr.benefits.v1',
  'hr.learning.v1',
  'hr.global.v1',
  'hr.contingent.v1',
  'hr.analytics.v1',
  'hr.wellbeing.v1',
];

exports.up = (pgm) => {
  pgm.sql(`
    WITH resolved AS (
      SELECT
        id,
        COALESCE(
          NULLIF(metadata->>'topic', ''),
          CASE
            WHEN aggregate_type IN ('AbsenceRequest', 'AbsenceAccrualBalance', 'LeaveCase', 'LeaveEntitlement')
              OR event_name LIKE 'AbsenceRequest%'
              OR event_name LIKE 'AbsenceAccrualBalance%'
              OR event_name LIKE 'LeaveCase%'
              OR event_name LIKE 'LeaveEntitlement%'
              THEN 'hr.absence.v1'
            WHEN aggregate_type IN ('TimeClockEvent', 'Timesheet', 'AttendanceException', 'AttendanceCorrectionRequest', 'Overtime', 'ShiftSchedule', 'ShiftSwapRequest', 'OpenShift')
              OR event_name LIKE 'TimeClockEvent%'
              OR event_name LIKE 'Timesheet%'
              OR event_name LIKE 'AttendanceException%'
              OR event_name LIKE 'AttendanceCorrectionRequest%'
              OR event_name LIKE 'Overtime%'
              THEN 'hr.time.v1'
            WHEN aggregate_type IN ('PayrollCycle', 'PayrollInput', 'PayrollCalculation', 'PayrollCalculationRun', 'PayrollResultLine', 'Payslip')
              OR event_name LIKE 'PayrollCycle%'
              OR event_name LIKE 'PayrollInput%'
              OR event_name LIKE 'PayrollCalculation%'
              OR event_name LIKE 'PayrollResultLine%'
              OR event_name LIKE 'Payslip%'
              THEN 'hr.payroll.v1'
            WHEN aggregate_type IN ('CompensationPlan', 'SalaryStructure', 'CompensationReview', 'CompensationChange', 'BonusCycle', 'EquityGrant', 'PayScale', 'VariableCompPlan', 'TotalCompensationStatement')
              OR event_name LIKE 'CompensationPlan%'
              OR event_name LIKE 'CompensationChange%'
              OR event_name LIKE 'TotalCompensationStatement%'
              OR event_name LIKE 'BonusCycle%'
              OR event_name LIKE 'EquityGrant%'
              OR event_name LIKE 'PayScale%'
              THEN 'hr.compensation.v1'
            WHEN aggregate_type IN ('BenefitsProgram', 'BenefitsEnrollment', 'Dependent', 'LifeEvent', 'SpendingAccount', 'CarrierReconciliationRun')
              OR event_name LIKE 'BenefitsEnrollment%'
              OR event_name LIKE 'BenefitsProgram%'
              OR event_name LIKE 'Dependent%'
              OR event_name LIKE 'LifeEvent%'
              OR event_name LIKE 'CarrierReconciliation%'
              THEN 'hr.benefits.v1'
            WHEN aggregate_type IN ('OnboardingPlan', 'OnboardingTask')
              OR event_name LIKE 'OnboardingPlan%'
              OR event_name LIKE 'OnboardingTask%'
              THEN 'hr.onboarding.v1'
            WHEN aggregate_type IN ('JobRequisition', 'CandidateApplication', 'Candidate', 'Offer')
              OR event_name LIKE 'JobRequisition%'
              OR event_name LIKE 'CandidateApplication%'
              OR event_name LIKE 'Candidate%'
              OR event_name LIKE 'Offer%'
              THEN 'hr.recruiting.v1'
            WHEN aggregate_type IN ('LearningCourse', 'LearningAssignment', 'Certification', 'LearningContentPackage')
              OR event_name LIKE 'LearningCourse%'
              OR event_name LIKE 'LearningAssignment%'
              OR event_name LIKE 'Certification%'
              OR event_name LIKE 'ContentPackage%'
              THEN 'hr.learning.v1'
            WHEN aggregate_type IN ('ReportDefinition', 'ReportExecution', 'ReportSchedule', 'PayGapReport', 'PayEquityReview', 'HrAiUseCase', 'CalculatedField', 'ServiceUsageMetric', 'ServiceUsageSummary')
              OR event_name LIKE 'Report%'
              OR event_name LIKE 'ServiceUsage%'
              OR event_name LIKE 'CalculatedField%'
              THEN 'hr.analytics.v1'
            WHEN aggregate_type IN ('LegalEntity', 'OrgUnit', 'Manager', 'PolicyDocument', 'PolicyAcknowledgement', 'LegalHold', 'StatutoryReport', 'CountryRuleSet', 'CountryPolicyPack')
              OR event_name LIKE 'LegalEntity%'
              OR event_name LIKE 'OrgUnit%'
              OR event_name LIKE 'Manager%'
              OR event_name LIKE 'Policy%'
              OR event_name LIKE 'CountryPolicy%'
              OR event_name LIKE 'StatutoryReport%'
              THEN 'hr.global.v1'
            ELSE 'hr.core.v1'
          END
        ) AS topic
      FROM "hr_platform"."outbox_events"
      WHERE NULLIF(event_topic, '') IS NULL
    )
    UPDATE "hr_platform"."outbox_events" events
    SET
      event_topic = resolved.topic,
      event_schema_version = COALESCE(NULLIF(events.event_schema_version, 0), 1),
      envelope_version = COALESCE(NULLIF(events.envelope_version, 0), 1),
      metadata = jsonb_set(
        COALESCE(events.metadata, '{}'::jsonb),
        '{topic}',
        to_jsonb(resolved.topic),
        true
      )
    FROM resolved
    WHERE events.id = resolved.id;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE "hr_platform"."outbox_events"
    SET
      event_topic = NULL,
      metadata = COALESCE(metadata, '{}'::jsonb) - 'topic'
    WHERE event_topic = ANY(ARRAY[${KNOWN_TOPICS.map((topic) => `'${topic}'`).join(', ')}])
      AND metadata->>'topic' = event_topic;
  `);
};
