/**
 * @file Self-Service Command Allowlists
 * @description Allowlists for Employee and Manager self-service commands.
 */

/** Commands permitted for Employee (Self-Service) actors. */
export const EmployeeSelfServiceAllowlist: readonly string[] = [
  'UpdatePersonalInfo',
  'UpdateContactDetails',
  'UpdateEmergencyContact',
  'UpdateBankAccount',
  'SubmitAbsenceRequest',
  'CancelAbsenceRequest',
  'SubmitTimesheet',
  'EnrollInBenefits',
  'UpdateBenefitElection',
  'SubmitLifeEvent',
  'AcknowledgePolicy',
  'UpdateConsentPreference',
  'CreateGoal',
  'UpdateGoal',
  'CompleteLearning',
  'SubmitHRCase',
  'ViewPayslip',
  'ViewTotalCompensation',
  'UpdateProfilePhoto',
  'UpdateSkills',
];

/** Commands permitted for Manager self-service actors. */
export const ManagerSelfServiceAllowlist: readonly string[] = [
  'UpdatePersonalInfo',
  'UpdateContactDetails',
  'UpdateEmergencyContact',
  'SubmitAbsenceRequest',
  'CancelAbsenceRequest',
  'SubmitTimesheet',
  'AcknowledgePolicy',
  'UpdateConsentPreference',
  'CreateGoal',
  'UpdateGoal',
  'CompleteLearning',
  'SubmitHRCase',
  'ViewPayslip',
  'ViewTotalCompensation',
  // Manager-specific commands
  'ApproveAbsence',
  'RejectAbsence',
  'ApproveTimesheet',
  'RejectTimesheet',
  'SubmitCompensationRecommendation',
  'SubmitPromotionRequest',
  'SubmitTransferRequest',
  'SubmitRecruitingRequisition',
  'RecordPerformanceRating',
  'SubmitDisciplinaryAction',
  'ApproveShiftSwap',
  'SubmitTerminationRequest',
  'TeamAnalyticsView',
];

/** Commands that require an additional approval workflow. */
const REQUIRES_APPROVAL: readonly string[] = [
  'UpdateBankAccount',
  'SubmitCompensationRecommendation',
  'SubmitPromotionRequest',
  'SubmitTransferRequest',
  'SubmitTerminationRequest',
  'SubmitDisciplinaryAction',
  'UpdateBenefitElection',
  'SubmitLifeEvent',
];

/** Commands that are forbidden regardless of actor type. */
const FORBIDDEN_COMMANDS: readonly string[] = [
  'ApproveOwnCompensationChange',
  'ApproveOwnBreakGlass',
  'DeleteLegalHold',
  'BypassSoD',
  'DirectDatabaseWrite',
];

/**
 * Validates self-service commands against allowlists and approval rules.
 */
export class SelfServiceValidator {
  /**
   * Check if a command is allowed for an Employee actor.
   */
  isEmployeeAllowed(commandName: string): boolean {
    return EmployeeSelfServiceAllowlist.includes(commandName);
  }

  /**
   * Check if a command is allowed for a Manager actor.
   */
  isManagerAllowed(commandName: string): boolean {
    return ManagerSelfServiceAllowlist.includes(commandName);
  }

  /**
   * Check if a command requires an additional approval workflow.
   */
  requiresApproval(commandName: string, actorType: 'EMPLOYEE' | 'MANAGER'): boolean {
    // Both employee and manager require approval for the same set;
    // this parameter is kept for future differentiation.
    void actorType;
    return REQUIRES_APPROVAL.includes(commandName);
  }

  /**
   * Check if a command is universally forbidden.
   */
  isForbidden(commandName: string, actorType: 'EMPLOYEE' | 'MANAGER'): boolean {
    void actorType;
    return FORBIDDEN_COMMANDS.includes(commandName);
  }
}
