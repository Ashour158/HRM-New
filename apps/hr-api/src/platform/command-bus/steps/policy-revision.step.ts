import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { makeError } from '../command-bus-errors.js';
import { policyScopeEvidence, policyScopeMatches, policyScopeSpecificity, resolveSubjectWorkerId } from '../command-bus.utils.js';
import type { RuntimeSetupResolver } from './runtime-setup.resolver.js';
import type { CommandPolicyDecisionEvidence, GovernedCommandPolicyRule } from './types.js';
import type { RuntimePolicyArea, RuntimePolicyRevisionEvidence } from '../../../domains/hcm-setup/hcm-setup.types.js';

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
    commandPatterns: [/^(Accept|Achieve|Acknowledge|Activate|Add|Analyze|Appeal|Apply|Approve|Arbitrate|Archive|Arm|Assign|Attach|Award|Block|Breach|Calculate|Calibrate|Cancel|Clear|Close|Complete|Configure|Contest|Create|Deactivate|Decline|Deliver|Deprecate|Detect|Dispute|Draft|Escalate|End|Enroll|Enter|Execute|Exempt|Exercise|Expire|Extend|Fail|Fill|Finalize|Flag|Forfeit|Freeze|Generate|Hire|Implement|Initiate|Investigate|Launch|Make|Mark|Meet|Move|Negotiate|Notify|Open|Parse|Pause|Plan|Publish|Queue|Ratify|Rearm|Reassign|Recalculate|Reconcile|Record|Register|Reject|Remove|Renew|Resolve|Restructure|Retire|Review|Revise|Revoke|Run|Schedule|Screen|Send|Setup|Simulate|Skip|Start|Submit|Supersede|Suspend|Terminate|Trigger|Unfreeze|Update|Uphold|Vacate|Validate|Withdraw)/i],
  },
];

export function requiredPolicyAreaForCommand(command: Pick<HrCommandEnvelope<unknown>, 'aggregateType' | 'commandName'>): RuntimePolicyArea | undefined {
  return GOVERNED_COMMAND_POLICY_MATRIX.find((rule) => (
    rule.aggregateTypes.includes(command.aggregateType)
    || rule.commandPatterns.some((pattern) => pattern.test(command.commandName))
  ))?.area;
}

/**
 * Enforces that a governed command has a matching, unambiguous *applied*
 * Policy Center revision before it may execute, and produces the
 * `CommandPolicyDecisionEvidence` written to the audit trail and the
 * Policy Center evidence ledger either way (allowed or denied).
 */
export class PolicyRevisionStep {
  constructor(private readonly runtimeSetup: RuntimeSetupResolver) {}

  async enforce(command: HrCommandEnvelope<unknown>): Promise<CommandPolicyDecisionEvidence | undefined> {
    if (command.actor.actorType === 'SYSTEM') return undefined;
    if (command.aggregateType === 'ApprovalChain') return undefined;

    const requiredArea = requiredPolicyAreaForCommand(command);
    if (!requiredArea) return undefined;

    const setup = await this.runtimeSetup.getSetup(command);
    const revisions = setup?.runtimePolicyRevisions ?? [];
    const matching = revisions.filter((candidate) => (
      candidate.area === requiredArea
      && candidate.status === 'APPLIED'
      && policyScopeMatches(candidate.scope, command)
    ));
    if (matching.length >= 1) {
      const highestSpecificity = Math.max(...matching.map((candidate) => policyScopeSpecificity(candidate.scope)));
      const mostSpecific = matching.filter((candidate) => policyScopeSpecificity(candidate.scope) === highestSpecificity);
      if (mostSpecific.length === 1) {
        return this.buildAllowedPolicyDecisionEvidence(command, requiredArea, mostSpecific[0], matching);
      }

      const conflictingPolicyRevisionIds = mostSpecific.map((candidate) => candidate.revisionId);
      const reason = `${requiredArea} command ${command.commandName} has conflicting applied Policy Center revisions at the same scope precedence: ${conflictingPolicyRevisionIds.join(', ')}.`;
      throw makeError(
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
    throw makeError(
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

  completeEvidence(
    evidence: CommandPolicyDecisionEvidence | undefined,
    result: CommandResult<unknown>,
  ): CommandPolicyDecisionEvidence | undefined {
    if (!evidence) return undefined;
    return {
      ...evidence,
      sourceRecordId: evidence.sourceRecordId ?? result.aggregateId.value,
    };
  }

  private buildAllowedPolicyDecisionEvidence(
    command: HrCommandEnvelope<unknown>,
    serviceArea: RuntimePolicyArea,
    revision: RuntimePolicyRevisionEvidence,
    evaluatedRevisions: RuntimePolicyRevisionEvidence[] = [revision],
  ): CommandPolicyDecisionEvidence {
    const subjectWorkerId = resolveSubjectWorkerId(command)?.value;
    return {
      serviceArea,
      policyRevisionId: revision.revisionId,
      engineName: revision.engineName,
      engineVersion: revision.engineVersion,
      scopeMatch: policyScopeEvidence(revision.scope, command),
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
    const subjectWorkerId = resolveSubjectWorkerId(command)?.value;
    const firstRevision = conflictingRevisions[0] ?? evaluatedRevisions[0];
    return {
      serviceArea,
      engineName: firstRevision?.engineName ?? 'PolicyApplicationEngine',
      engineVersion: firstRevision?.engineVersion ?? 'unapplied',
      scopeMatch: policyScopeEvidence(firstRevision?.scope, command),
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
}
