/**
 * @file Segregation of Duties Matrix
 * @description 31 canonical SoD rules with declarative rule definitions.
 */

// ------------------------------------------------------------------
// SoD Rule Codes
// ------------------------------------------------------------------

export const COMPENSATION_PROPOSER_CANNOT_APPROVE = 'COMPENSATION_PROPOSER_CANNOT_APPROVE';
export const PAYROLL_PREPARER_CANNOT_APPROVE = 'PAYROLL_PREPARER_CANNOT_APPROVE';
export const INTERVIEWER_CANNOT_FINAL_OFFER_APPROVE = 'INTERVIEWER_CANNOT_FINAL_OFFER_APPROVE';
export const ER_SUBJECT_MANAGER_CANNOT_INVESTIGATE = 'ER_SUBJECT_MANAGER_CANNOT_INVESTIGATE';
export const BREAK_GLASS_REQUESTER_CANNOT_APPROVE = 'BREAK_GLASS_REQUESTER_CANNOT_APPROVE';
export const COUNTRY_POLICY_UPLOADER_CANNOT_LEGAL_APPROVE = 'COUNTRY_POLICY_UPLOADER_CANNOT_LEGAL_APPROVE';
export const BONUS_RECOMMENDER_CANNOT_CALIBRATE_APPROVE = 'BONUS_RECOMMENDER_CANNOT_CALIBRATE_APPROVE';
export const EQUITY_GRANT_DRAFTER_CANNOT_APPROVE = 'EQUITY_GRANT_DRAFTER_CANNOT_APPROVE';
export const PAY_EQUITY_AUDIT_PREPARER_CANNOT_ACTION_APPROVE = 'PAY_EQUITY_AUDIT_PREPARER_CANNOT_ACTION_APPROVE';
export const BENEFITS_ENROLLMENT_REQUESTER_CANNOT_EXCEPTION_APPROVE = 'BENEFITS_ENROLLMENT_REQUESTER_CANNOT_EXCEPTION_APPROVE';
export const CARRIER_RECONCILIATION_PREPARER_CANNOT_APPROVE = 'CARRIER_RECONCILIATION_PREPARER_CANNOT_APPROVE';
export const PERFORMANCE_RATER_CANNOT_CALIBRATION_APPROVE = 'PERFORMANCE_RATER_CANNOT_CALIBRATION_APPROVE';
export const DISCIPLINARY_REQUESTER_CANNOT_FINAL_APPROVE = 'DISCIPLINARY_REQUESTER_CANNOT_FINAL_APPROVE';
export const TERMINATION_REQUESTER_CANNOT_FINAL_APPROVE = 'TERMINATION_REQUESTER_CANNOT_FINAL_APPROVE';
export const HIRING_MANAGER_CANNOT_BACKGROUND_CHECK_DECIDE = 'HIRING_MANAGER_CANNOT_BACKGROUND_CHECK_DECIDE';
export const OFFER_DRAFTER_CANNOT_OFFER_APPROVE = 'OFFER_DRAFTER_CANNOT_OFFER_APPROVE';
export const HR_ADMIN_CANNOT_SELF_APPROVE_COMPENSATION = 'HR_ADMIN_CANNOT_SELF_APPROVE_COMPENSATION';
export const HR_ADMIN_CANNOT_APPROVE_OWN_BREAK_GLASS = 'HR_ADMIN_CANNOT_APPROVE_OWN_BREAK_GLASS';
export const HRBP_CANNOT_CALIBRATE_OWN_PERFORMANCE = 'HRBP_CANNOT_CALIBRATE_OWN_PERFORMANCE';
export const HRBP_CANNOT_DISCIPLINARY_APPROVE_OWN_REQUEST = 'HRBP_CANNOT_DISCIPLINARY_APPROVE_OWN_REQUEST';
export const COMPLIANCE_REPORT_PREPARER_CANNOT_APPROVE = 'COMPLIANCE_REPORT_PREPARER_CANNOT_APPROVE';
export const DEI_REPORT_PREPARER_CANNOT_PUBLISH_APPROVE = 'DEI_REPORT_PREPARER_CANNOT_PUBLISH_APPROVE';
export const CONTRACT_DRAFTER_CANNOT_LEGAL_APPROVE = 'CONTRACT_DRAFTER_CANNOT_LEGAL_APPROVE';
export const ORG_DESIGN_DRAFTER_CANNOT_FINAL_APPROVE = 'ORG_DESIGN_DRAFTER_CANNOT_FINAL_APPROVE';
export const RIF_SCENARIO_DRAFTER_CANNOT_FINAL_APPROVE = 'RIF_SCENARIO_DRAFTER_CANNOT_FINAL_APPROVE';
export const WORKFORCE_PLAN_PREPARER_CANNOT_APPROVE = 'WORKFORCE_PLAN_PREPARER_CANNOT_APPROVE';
export const LEARNING_UPLOADER_CANNOT_CONTENT_APPROVE = 'LEARNING_UPLOADER_CANNOT_CONTENT_APPROVE';
export const TAX_JURISDICTION_REVIEWER_CANNOT_PAYROLL_FINALIZE = 'TAX_JURISDICTION_REVIEWER_CANNOT_PAYROLL_FINALIZE';
export const PAYROLL_CALCULATION_PREPARER_CANNOT_FINAL_APPROVE = 'PAYROLL_CALCULATION_PREPARER_CANNOT_FINAL_APPROVE';
export const DATA_EXPORT_REQUESTER_CANNOT_EXPORT_APPROVE = 'DATA_EXPORT_REQUESTER_CANNOT_EXPORT_APPROVE';
export const COUNTRY_POLICY_UPLOADER_CANNOT_FINAL_PUBLISH = 'COUNTRY_POLICY_UPLOADER_CANNOT_FINAL_PUBLISH';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** SoD enforcement severity. */
export type SodEnforcement = 'BLOCK' | 'WARN' | 'AUDIT';

/** SoD evaluation result. */
export interface SodResult {
  violated: boolean;
  violatedRules: SodRule[];
  enforcement: SodEnforcement;
  message: string;
}

/** Context provided for SoD checks. */
export interface SodContext {
  /** The permission being exercised. */
  actionPermission?: string;
  /** The command/action name. */
  actionName?: string;
  /** Subject worker ID if applicable. */
  subjectWorkerId?: string;
  /** Whether break-glass is active. */
  breakGlassActive?: boolean;
}

/** Declarative SoD rule definition. */
export interface SodRule {
  code: string;
  description: string;
  /** Role pairs that are incompatible (both cannot be held). */
  incompatibleRolePairs: readonly [string, string][];
  /** Permission pairs that are incompatible (both cannot be exercised by same actor). */
  incompatiblePermissionPairs: readonly [string, string][];
  /** Point in the flow where this rule is enforced. */
  enforcementPoint: string;
  /** Whether break-glass can override this rule. */
  breakGlassAllowed: boolean;
}

// ------------------------------------------------------------------
// Rule Catalog
// ------------------------------------------------------------------

const SOD_RULES: readonly SodRule[] = [
  {
    code: COMPENSATION_PROPOSER_CANNOT_APPROVE,
    description: 'An actor who proposes a compensation change cannot approve the same change.',
    incompatibleRolePairs: [['COMPENSATION_ADMIN', 'COMPENSATION_ADMIN']],
    incompatiblePermissionPairs: [['COMPENSATION_CHANGE', 'COMPENSATION_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: PAYROLL_PREPARER_CANNOT_APPROVE,
    description: 'Payroll preparer cannot approve the same payroll run.',
    incompatibleRolePairs: [['PAYROLL_ADMIN', 'PAYROLL_ADMIN']],
    incompatiblePermissionPairs: [['PAYROLL_CREATE', 'PAYROLL_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: INTERVIEWER_CANNOT_FINAL_OFFER_APPROVE,
    description: 'An interviewer cannot be the final offer approver for the same candidate.',
    incompatibleRolePairs: [['RECRUITER', 'RECRUITER']],
    incompatiblePermissionPairs: [['RECRUITING_CREATE', 'RECRUITING_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: ER_SUBJECT_MANAGER_CANNOT_INVESTIGATE,
    description: 'A manager who is the subject of an ER case cannot investigate it.',
    incompatibleRolePairs: [['MANAGER', 'ER_SPECIALIST']],
    incompatiblePermissionPairs: [],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: BREAK_GLASS_REQUESTER_CANNOT_APPROVE,
    description: 'A break-glass requester cannot approve their own request.',
    incompatibleRolePairs: [],
    incompatiblePermissionPairs: [],
    enforcementPoint: 'BREAK_GLASS_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: COUNTRY_POLICY_UPLOADER_CANNOT_LEGAL_APPROVE,
    description: 'Country policy uploader cannot also be the legal approver for the same pack.',
    incompatibleRolePairs: [['GLOBAL_HR_COMPLIANCE_OFFICER', 'LEGAL']],
    incompatiblePermissionPairs: [['COMPLIANCE_MANAGE', 'LEGAL_HOLD_MANAGE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: true,
  },
  {
    code: BONUS_RECOMMENDER_CANNOT_CALIBRATE_APPROVE,
    description: 'Bonus recommender cannot approve calibration for the same cycle.',
    incompatibleRolePairs: [['MANAGER', 'COMPENSATION_ADMIN']],
    incompatiblePermissionPairs: [['COMPENSATION_CHANGE', 'COMPENSATION_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: EQUITY_GRANT_DRAFTER_CANNOT_APPROVE,
    description: 'Equity grant drafter cannot approve the same grant.',
    incompatibleRolePairs: [['COMPENSATION_ADMIN', 'COMPENSATION_ADMIN']],
    incompatiblePermissionPairs: [['COMPENSATION_CHANGE', 'COMPENSATION_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: PAY_EQUITY_AUDIT_PREPARER_CANNOT_ACTION_APPROVE,
    description: 'Pay equity audit preparer cannot approve the resulting action plan.',
    incompatibleRolePairs: [['COMPENSATION_ADMIN', 'COMPENSATION_ADMIN']],
    incompatiblePermissionPairs: [['REPORT_CREATE', 'COMPENSATION_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: BENEFITS_ENROLLMENT_REQUESTER_CANNOT_EXCEPTION_APPROVE,
    description: 'Benefits enrollment requester cannot approve their own exception.',
    incompatibleRolePairs: [['EMPLOYEE', 'BENEFITS_ADMIN']],
    incompatiblePermissionPairs: [['BENEFITS_ENROLL', 'BENEFITS_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: CARRIER_RECONCILIATION_PREPARER_CANNOT_APPROVE,
    description: 'Carrier reconciliation preparer cannot approve their own reconciliation.',
    incompatibleRolePairs: [['BENEFITS_ADMIN', 'BENEFITS_ADMIN']],
    incompatiblePermissionPairs: [['BENEFITS_ENROLL', 'BENEFITS_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: PERFORMANCE_RATER_CANNOT_CALIBRATION_APPROVE,
    description: 'Performance rater cannot be calibration approver for the same review.',
    incompatibleRolePairs: [['MANAGER', 'MANAGER']],
    incompatiblePermissionPairs: [['PERFORMANCE_CREATE', 'PERFORMANCE_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: DISCIPLINARY_REQUESTER_CANNOT_FINAL_APPROVE,
    description: 'Disciplinary action requester cannot be the final approver.',
    incompatibleRolePairs: [['MANAGER', 'HR_ADMIN']],
    incompatiblePermissionPairs: [],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: TERMINATION_REQUESTER_CANNOT_FINAL_APPROVE,
    description: 'Termination requester cannot be the final approver.',
    incompatibleRolePairs: [['MANAGER', 'HR_ADMIN']],
    incompatiblePermissionPairs: [['WORKER_TERMINATE', 'WORKER_TERMINATE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: HIRING_MANAGER_CANNOT_BACKGROUND_CHECK_DECIDE,
    description: 'Hiring manager cannot be background check decision maker for own candidates.',
    incompatibleRolePairs: [['MANAGER', 'RECRUITER']],
    incompatiblePermissionPairs: [['RECRUITING_CREATE', 'RECRUITING_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: OFFER_DRAFTER_CANNOT_OFFER_APPROVE,
    description: 'Offer drafter cannot approve their own offer.',
    incompatibleRolePairs: [['RECRUITER', 'RECRUITER']],
    incompatiblePermissionPairs: [['RECRUITING_CREATE', 'RECRUITING_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: HR_ADMIN_CANNOT_SELF_APPROVE_COMPENSATION,
    description: 'HR Admin cannot self-approve their own compensation changes.',
    incompatibleRolePairs: [['HR_ADMIN', 'HR_ADMIN']],
    incompatiblePermissionPairs: [['COMPENSATION_CHANGE', 'COMPENSATION_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: HR_ADMIN_CANNOT_APPROVE_OWN_BREAK_GLASS,
    description: 'HR Admin cannot approve their own break-glass requests.',
    incompatibleRolePairs: [['HR_ADMIN', 'HR_ADMIN']],
    incompatiblePermissionPairs: [],
    enforcementPoint: 'BREAK_GLASS_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: HRBP_CANNOT_CALIBRATE_OWN_PERFORMANCE,
    description: 'HRBP cannot be calibration approver for their own performance ratings.',
    incompatibleRolePairs: [['HRBP', 'HRBP']],
    incompatiblePermissionPairs: [['PERFORMANCE_CREATE', 'PERFORMANCE_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: HRBP_CANNOT_DISCIPLINARY_APPROVE_OWN_REQUEST,
    description: 'HRBP cannot approve their own disciplinary action requests.',
    incompatibleRolePairs: [['HRBP', 'HRBP']],
    incompatiblePermissionPairs: [],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: COMPLIANCE_REPORT_PREPARER_CANNOT_APPROVE,
    description: 'Compliance report preparer cannot approve the same report.',
    incompatibleRolePairs: [['COMPLIANCE_OFFICER', 'COMPLIANCE_OFFICER']],
    incompatiblePermissionPairs: [['REPORT_CREATE', 'COMPLIANCE_MANAGE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: DEI_REPORT_PREPARER_CANNOT_PUBLISH_APPROVE,
    description: 'DEI report preparer cannot approve publication of the same report.',
    incompatibleRolePairs: [['COMPLIANCE_OFFICER', 'EXECUTIVE_VIEWER']],
    incompatiblePermissionPairs: [['REPORT_CREATE', 'REPORT_EXPORT']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: CONTRACT_DRAFTER_CANNOT_LEGAL_APPROVE,
    description: 'Contract drafter cannot be the legal approver where independence is required.',
    incompatibleRolePairs: [['HR_ADMIN', 'LEGAL']],
    incompatiblePermissionPairs: [['WORKER_CREATE', 'WORKER_UPDATE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: true,
  },
  {
    code: ORG_DESIGN_DRAFTER_CANNOT_FINAL_APPROVE,
    description: 'Org design drafter cannot be the final approver.',
    incompatibleRolePairs: [['WORKFORCE_PLANNING_ADMIN', 'EXECUTIVE_VIEWER']],
    incompatiblePermissionPairs: [['ORG_CREATE', 'ORG_UPDATE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: RIF_SCENARIO_DRAFTER_CANNOT_FINAL_APPROVE,
    description: 'RIF scenario drafter cannot be the final approver.',
    incompatibleRolePairs: [['WORKFORCE_PLANNING_ADMIN', 'EXECUTIVE_VIEWER']],
    incompatiblePermissionPairs: [['ORG_UPDATE', 'ORG_DELETE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: WORKFORCE_PLAN_PREPARER_CANNOT_APPROVE,
    description: 'Workforce plan preparer cannot approve their own plan.',
    incompatibleRolePairs: [['WORKFORCE_PLANNING_ADMIN', 'WORKFORCE_PLANNING_ADMIN']],
    incompatiblePermissionPairs: [['REPORT_CREATE', 'REPORT_EXPORT']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: LEARNING_UPLOADER_CANNOT_CONTENT_APPROVE,
    description: 'Learning content uploader cannot approve the same content where policy requires independence.',
    incompatibleRolePairs: [['LEARNING_ADMIN', 'LEARNING_ADMIN']],
    incompatiblePermissionPairs: [['LEARNING_ASSIGN', 'LEARNING_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: TAX_JURISDICTION_REVIEWER_CANNOT_PAYROLL_FINALIZE,
    description: 'Tax jurisdiction reviewer cannot finalize the same payroll.',
    incompatibleRolePairs: [['PAYROLL_ADMIN', 'PAYROLL_ADMIN']],
    incompatiblePermissionPairs: [['PAYROLL_CREATE', 'PAYROLL_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: PAYROLL_CALCULATION_PREPARER_CANNOT_FINAL_APPROVE,
    description: 'Payroll calculation preparer cannot be the final approver for the same calculation.',
    incompatibleRolePairs: [['PAYROLL_ADMIN', 'PAYROLL_ADMIN']],
    incompatiblePermissionPairs: [['PAYROLL_CREATE', 'PAYROLL_APPROVE']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: DATA_EXPORT_REQUESTER_CANNOT_EXPORT_APPROVE,
    description: 'Data export requester cannot approve their own export.',
    incompatibleRolePairs: [['INTEGRATION_ACTOR', 'HR_ADMIN']],
    incompatiblePermissionPairs: [['REPORT_CREATE', 'REPORT_EXPORT']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: false,
  },
  {
    code: COUNTRY_POLICY_UPLOADER_CANNOT_FINAL_PUBLISH,
    description: 'Country policy uploader cannot be the final publisher for the same pack.',
    incompatibleRolePairs: [['GLOBAL_HR_COMPLIANCE_OFFICER', 'GLOBAL_HR_COMPLIANCE_OFFICER']],
    incompatiblePermissionPairs: [['COMPLIANCE_MANAGE', 'ADMIN_SYSTEM']],
    enforcementPoint: 'COMMAND_GATEWAY',
    breakGlassAllowed: true,
  },
];

// ------------------------------------------------------------------
// Engine
// ------------------------------------------------------------------

/**
 * SoD matrix evaluator.
 */
export class SodMatrix {
  private readonly rules: readonly SodRule[];

  constructor(rules: readonly SodRule[] = SOD_RULES) {
    this.rules = rules;
  }

  /**
   * Check whether the actor's roles and intended action violate any SoD rule.
   */
  checkSoD(actorRoles: string[], action: string, context: SodContext): SodResult {
    const violatedRules: SodRule[] = [];

    for (const rule of this.rules) {
      if (context.breakGlassActive && rule.breakGlassAllowed) continue;

      const roleConflict = this.hasRoleConflict(actorRoles, rule);
      const permissionConflict = context.actionPermission
        ? this.hasPermissionConflict([context.actionPermission, action], rule)
        : false;

      if (roleConflict || permissionConflict) {
        violatedRules.push(rule);
      }
    }

    const violated = violatedRules.length > 0;
    return {
      violated,
      violatedRules,
      enforcement: violated ? 'BLOCK' : 'AUDIT',
      message: violated
        ? `SoD violation(s): ${violatedRules.map((r) => r.code).join(', ')}`
        : 'No SoD violations detected.',
    };
  }

  /**
   * Find all SoD rules that would be violated by holding the given roles.
   */
  getConflicts(actorRoles: string[]): SodRule[] {
    return this.rules.filter((rule) => this.hasRoleConflict(actorRoles, rule));
  }

  private hasRoleConflict(actorRoles: string[], rule: SodRule): boolean {
    if (rule.incompatibleRolePairs.length === 0) return false;
    return rule.incompatibleRolePairs.some(([a, b]) => {
      if (a === b) return false; // self-role conflicts require contextual evaluation (permission-based)
      const hasA = actorRoles.includes(a);
      const hasB = actorRoles.includes(b);
      return hasA && hasB;
    });
  }

  private hasPermissionConflict(actionPerms: string[], rule: SodRule): boolean {
    if (rule.incompatiblePermissionPairs.length === 0) return false;
    return rule.incompatiblePermissionPairs.some(([a, b]) => {
      const hasA = actionPerms.includes(a);
      const hasB = actionPerms.includes(b);
      return hasA && hasB;
    });
  }
}
