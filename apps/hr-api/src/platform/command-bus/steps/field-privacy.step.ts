import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { AccessControlService, FieldAccessDecision } from '@hcm/access-control';
import { makeError } from '../command-bus-errors.js';
import { flattenPayloadPaths } from '../command-bus.utils.js';

export const SENSITIVE_FIELD_RULES: Array<{
  policyField: string;
  dataClassification: 'HIGH_SENSITIVITY' | 'SPECIAL_CATEGORY' | 'LEGAL_HOLD';
  allowedWriterRoles: string[];
  patterns: RegExp[];
}> = [
  {
    policyField: 'worker.compensation.salary',
    dataClassification: 'HIGH_SENSITIVITY',
    allowedWriterRoles: ['HR_ADMIN', 'PAYROLL_ADMIN', 'COMPENSATION_ADMIN', 'SUPER_ADMIN'],
    // NOTE: no bare /payroll/i pattern here (HCM-P0-5 round 3). Every payroll
    // command payload carries an id-reference field whose name merely
    // contains the substring "payroll" (payrollCycleId, payrollInputId,
    // payrollCalculationRunId, payrollResultLineId, ...) -- a bare /payroll/i
    // pattern false-positives on those structural id fields and treats them
    // as a compensation.salary mutation, even though none of them carry
    // salary data. That silently required every payroll command to be run by
    // an allowedWriterRoles actor (previously always true, since every
    // payroll actor also held HR_ADMIN/PAYROLL_ADMIN) and broke the first
    // actor that legitimately doesn't -- PAYROLL_APPROVER (HCM-P0-5), which
    // holds PAYROLL_APPROVE without PAYROLL_CREATE/HR_ADMIN/PAYROLL_ADMIN by
    // design so it can pass the preparer/approver SoD check. Actual
    // money-bearing fields are already covered by the specific patterns
    // below (salary/gross/net/taxAmount/insuranceAmount/deduction).
    patterns: [/salary/i, /gross/i, /net/i, /taxAmount/i, /insuranceAmount/i, /deduction/i],
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
    // Voluntary candidate EEO self-identification (race/ethnicity, gender
    // identity, veteran status, disability status). RECRUITER is
    // deliberately excluded — this data must be self-reported by the
    // candidate (voluntarily), never entered by a hiring decision-maker.
    // System/service-account intake (e.g. a public careers-site self-ID
    // form) bypasses this whole check per the actorType guard above.
    policyField: 'candidate.eeoSelfIdentification',
    dataClassification: 'SPECIAL_CATEGORY',
    allowedWriterRoles: ['COMPLIANCE_OFFICER', 'DEI_ANALYTICS_ADMIN', 'HR_ADMIN', 'SUPER_ADMIN'],
    patterns: [/raceEthnicity/i, /genderIdentity/i, /veteranStatus/i, /disabilityStatus/i, /declinedToSelfIdentify/i, /eeoSelfIdentification/i],
  },
  {
    policyField: 'worker.legalHoldNotes',
    dataClassification: 'LEGAL_HOLD',
    allowedWriterRoles: ['LEGAL', 'COMPLIANCE_OFFICER', 'SUPER_ADMIN'],
    patterns: [/legalHold/i, /retentionHold/i],
  },
];

/** HR data-privacy field policy gate: blocks mutation of sensitive fields by unauthorized roles. */
export class FieldPrivacyStep {
  constructor(private readonly accessControl: AccessControlService) {}

  async evaluate(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (command.actor.actorType === 'SYSTEM' || command.actor.actorType === 'SERVICE_ACCOUNT') {
      return;
    }

    const payloadPaths = flattenPayloadPaths(command.payload);
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
      throw makeError(
        command,
        CommandPipelineStep.EVALUATE_HR_DATA_PRIVACY_FIELD_POLICY,
        'FIELD_POLICY_DENIED',
        `Field policy denied mutation of ${[...new Set(denied)].join(', ')}`,
        false,
      );
    }
  }
}
