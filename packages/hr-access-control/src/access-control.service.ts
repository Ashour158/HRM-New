/**
 * @file Access Control Service
 * @description Composed service integrating RBAC, ABAC, SoD, Field Policy, and Self-Service.
 */

import type { Uuid } from '@hcm/shared-kernel';
import { RbacEngine } from './rbac/rbac-engine.js';
import { AbacEngine, type AbacPolicy } from './abac/abac-engine.js';
import { AbacDimension, type AbacContext } from './abac/dimensions.js';
import { SodMatrix, type SodContext, type SodResult } from './sod/sod-matrix.js';
import { FieldPolicyEngine, type FieldAccessResult, type DataClassification } from './field-policy/field-policy.js';
import { SelfServiceValidator } from './self-service/allowlists.js';
import { BreakGlassValidator } from './break-glass/break-glass.js';

/** Actor representation passed to access control evaluations. */
export interface HrActor {
  workerId?: Uuid;
  roles: string[];
  actorType: 'SYSTEM' | 'INTEGRATION' | 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'HRBP' | 'EXECUTIVE' | 'EXTERNAL';
  employmentStatus?: string;
}

/** Command envelope for command-level access checks. */
export interface HrCommandEnvelope {
  commandName: string;
  commandType: string;
  aggregateType: string;
  aggregateId?: Uuid;
  payload?: Record<string, unknown>;
}

/** Composite access control decision for commands. */
export interface AccessControlDecision {
  allowed: boolean;
  rbacAllowed: boolean;
  abacAllowed: boolean;
  sodAllowed: boolean;
  selfServiceAllowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

/** Query access decision. */
export interface QueryAccessDecision {
  allowed: boolean;
  decision: 'ALLOW' | 'DENY' | 'CONDITIONAL';
  fields: FieldAccessResult[];
  reason?: string;
}

/**
 * Main access control service composing all engines.
 */
export class AccessControlService {
  private readonly rbac = new RbacEngine();
  private readonly abac = new AbacEngine();
  private readonly sod = new SodMatrix();
  private readonly fieldPolicy = new FieldPolicyEngine();
  private readonly selfService = new SelfServiceValidator();
  readonly breakGlass = new BreakGlassValidator();

  /**
   * Evaluate whether an actor may execute a command.
   */
  evaluateCommandAccess(
    command: HrCommandEnvelope,
    actor: HrActor,
  ): AccessControlDecision {
    const activeSelfServiceActor = this.isActiveSelfServiceActor(actor);
    // RBAC check
    const rbacAllowed = this.rbac.hasAnyPermission(actor.roles, this.inferPermissions(command));

    // Self-service allowlist
    let selfServiceAllowed = true;
    if (actor.actorType === 'EMPLOYEE') {
      selfServiceAllowed = this.selfService.isEmployeeAllowed(command.commandName);
    } else if (actor.actorType === 'MANAGER') {
      selfServiceAllowed = this.selfService.isManagerAllowed(command.commandName);
    }

    // SoD check
    const sodContext: SodContext = {
      actionName: command.commandName,
      actionPermission: this.inferPermissions(command)[0],
    };
    const sodResult = this.sod.checkSoD(actor.roles, command.commandName, sodContext);

    // Approval requirement
    const requiresApproval =
      actor.actorType === 'EMPLOYEE' || actor.actorType === 'MANAGER'
        ? this.selfService.requiresApproval(command.commandName, actor.actorType)
        : false;

    const allowed = activeSelfServiceActor && rbacAllowed && selfServiceAllowed && !sodResult.violated;

    return {
      allowed,
      rbacAllowed,
      abacAllowed: true, // command-level ABAC is evaluated downstream
      sodAllowed: !sodResult.violated,
      selfServiceAllowed,
      requiresApproval,
      reason: allowed
        ? undefined
        : this.buildDenialReason(activeSelfServiceActor, rbacAllowed, selfServiceAllowed, sodResult),
    };
  }

  /**
   * Evaluate field-level access for a specific field path.
   */
  evaluateFieldAccess(
    fieldPath: string,
    actorRoles: string[],
    abacContext: AbacContext,
    dataClassification: DataClassification,
  ): FieldAccessResult {
    return this.fieldPolicy.evaluateFieldAccess(fieldPath, actorRoles, abacContext, dataClassification);
  }

  /**
   * Evaluate whether a query type is accessible to the actor under ABAC context.
   */
  evaluateQueryAccess(
    queryType: string,
    actor: HrActor,
    abacContext: AbacContext,
  ): QueryAccessDecision {
    // Simple RBAC-based query permission mapping
    const queryPermission = `QUERY_${queryType}`;
    const rbacAllowed = this.rbac.hasPermission(actor.roles, queryPermission) || this.rbac.hasPermission(actor.roles, 'REPORT_READ');

    // ABAC policy: allow if scope overlap exists or self/manager relationship
    const policy: AbacPolicy = {
      conditions: [
        { dimension: AbacDimension.SELF, operator: 'true' },
        { dimension: AbacDimension.MANAGER_RELATIONSHIP, operator: 'true' },
      ],
      effect: 'ALLOW',
    };
    const abacDecision = this.abac.evaluate(abacContext, policy);
    const allowed = rbacAllowed && (abacDecision === 'ALLOW' || abacContext.breakGlassActive);

    return {
      allowed,
      decision: allowed ? 'ALLOW' : abacDecision,
      fields: [],
      reason: allowed ? undefined : 'Query access denied by RBAC or ABAC policy.',
    };
  }

  /**
   * Check SoD for a command and actor roles.
   */
  checkSoD(commandName: string, actorRoles: string[]): SodResult {
    const context: SodContext = { actionName: commandName };
    return this.sod.checkSoD(actorRoles, commandName, context);
  }

  /**
   * Get the list of allowed actions for an actor against an aggregate.
   */
  getAllowedActions(
    actor: HrActor,
    aggregateType: string,
    aggregateId?: Uuid,
  ): string[] {
    void aggregateId;
    if (!this.isActiveSelfServiceActor(actor)) {
      return [];
    }
    const perms = this.rbac.getEffectivePermissions(actor.roles);
    // Map permissions to action names based on aggregate type
    const actions: string[] = [];
    for (const perm of perms) {
      const domain = perm.split('_')[0];
      if (this.domainMatchesAggregate(domain, aggregateType)) {
        actions.push(perm);
      }
    }
    return actions;
  }

  private inferPermissions(command: HrCommandEnvelope): string[] {
    const perms: string[] = [];
    const prefix = this.mapAggregateTypeToPermissionPrefix(command.aggregateType);
    const commandName = this.normalizeCommandName(command.commandName);

    if (prefix === 'TIME') {
      if (commandName === 'RECORD_TIME_CLOCK_EVENT' || commandName === 'CREATE_ATTENDANCE_CORRECTION_REQUEST' || commandName === 'CREATE_ATTENDANCE_EXCEPTION') return ['TIME_READ'];
      if (commandName === 'REVIEW_ATTENDANCE_CORRECTION_REQUEST') return ['TIME_APPROVE'];
      if (commandName === 'FINALIZE_ATTENDANCE_DAILY_LEDGER') return ['PAYROLL_CREATE'];
      if (commandName.includes('APPROVE')) return ['TIME_APPROVE'];
      if (commandName.includes('GET') || commandName.includes('READ')) return ['TIME_READ'];
      return ['TIME_MANAGE'];
    }

    if (prefix === 'WORKFORCE') {
      if (commandName.includes('GET') || commandName.includes('READ') || commandName.includes('FIND') || commandName.includes('LIST')) return ['WORKFORCE_READ'];
      if (commandName.includes('APPROVE') || commandName.includes('REJECT') || commandName.includes('FILL') || commandName.includes('PUBLISH') || commandName.includes('ACTIVATE') || commandName.includes('CLOSE')) return ['WORKFORCE_APPROVE'];
      return ['WORKFORCE_SCHEDULE'];
    }

    if (prefix === 'SERVICE') {
      if (commandName === 'OPEN_HR_SERVICE_CASE' || commandName === 'SUBMIT_HR_CASE') return ['SERVICE_REQUEST'];
      if (commandName.includes('GET') || commandName.includes('READ') || commandName.includes('FIND') || commandName.includes('LIST')) return ['SERVICE_READ'];
      return ['SERVICE_MANAGE'];
    }

    if (prefix === 'PAYROLL') {
      if (commandName.includes('EXPORT')) return ['PAYROLL_EXPORT'];
      if (commandName.includes('APPROVE')) return ['PAYROLL_APPROVE'];
      if (commandName.includes('GET') || commandName.includes('READ')) return ['PAYROLL_READ'];
      return ['PAYROLL_CREATE'];
    }

    if (prefix === 'ABSENCE') {
      if (commandName === 'CREATE_ABSENCE_REQUEST' || commandName === 'SUBMIT_ABSENCE_REQUEST' || commandName === 'CANCEL_ABSENCE_REQUEST') return ['ABSENCE_READ', 'ABSENCE_MANAGE'];
      if (commandName === 'APPROVE_ABSENCE_REQUEST' || commandName === 'REJECT_ABSENCE_REQUEST') return ['ABSENCE_APPROVE', 'ABSENCE_MANAGE'];
      if (commandName.includes('APPROVE') || commandName.includes('REJECT')) return ['ABSENCE_APPROVE', 'ABSENCE_MANAGE'];
      return ['ABSENCE_MANAGE', 'ABSENCE_READ'];
    }

    if (prefix === 'PERFORMANCE') {
      if (commandName.includes('APPROVE')) return ['PERFORMANCE_APPROVE'];
      if (commandName.includes('CREATE') || commandName.includes('ADD')) return ['PERFORMANCE_CREATE'];
      if (commandName.includes('GET') || commandName.includes('READ') || commandName.includes('FIND') || commandName.includes('LIST')) return ['PERFORMANCE_READ'];
      return ['PERFORMANCE_WRITE'];
    }

    if (prefix === 'BENEFITS') {
      if (commandName.includes('APPROVE') || commandName.includes('RECONCILE')) return ['BENEFITS_APPROVE'];
      if (commandName.includes('GET') || commandName.includes('READ') || commandName.includes('FIND') || commandName.includes('LIST')) return ['BENEFITS_READ'];
      return ['BENEFITS_ENROLL'];
    }

    if (prefix === 'COMPENSATION') {
      if (commandName.includes('APPROVE')) return ['COMPENSATION_APPROVE'];
      if (commandName.includes('GET') || commandName.includes('READ') || commandName.includes('FIND') || commandName.includes('LIST')) return ['COMPENSATION_READ'];
      return ['COMPENSATION_CHANGE'];
    }

    if (prefix === 'RECRUITING') {
      if (commandName.includes('PUBLISH')) return ['RECRUITING_PUBLISH'];
      if (commandName.includes('APPROVE')) return ['RECRUITING_APPROVE'];
      if (commandName.includes('GET') || commandName.includes('READ') || commandName.includes('FIND') || commandName.includes('LIST')) return ['RECRUITING_READ'];
      return ['RECRUITING_CREATE'];
    }

    if (prefix === 'LEARNING') {
      if (commandName.includes('APPROVE')) return ['LEARNING_APPROVE'];
      if (commandName.includes('GET') || commandName.includes('READ') || commandName.includes('FIND') || commandName.includes('LIST')) return ['LEARNING_READ'];
      return ['LEARNING_ASSIGN'];
    }

    if (prefix === 'COMPLIANCE') {
      if (commandName.includes('GET') || commandName.includes('READ') || commandName.includes('FIND') || commandName.includes('LIST')) return ['COMPLIANCE_READ'];
      return ['COMPLIANCE_MANAGE'];
    }

    if (prefix === 'REPORT') {
      if (commandName.includes('EXPORT')) return ['REPORT_EXPORT'];
      if (commandName.includes('CREATE') || commandName.includes('GENERATE')) return ['REPORT_CREATE'];
      return ['REPORT_READ'];
    }

    if (prefix === 'WORKFLOW') {
      if (
        commandName.includes('APPROVE') ||
        commandName.includes('REJECT') ||
        commandName.includes('DELEGATE') ||
        commandName.includes('ESCALATE')
      ) {
        return ['WORKFLOW_APPROVE'];
      }
      return ['WORKFLOW_MANAGE'];
    }

    // Domains that follow the <DOMAIN>_READ / <DOMAIN>_WRITE / <DOMAIN>_APPROVE convention.
    // Approval-like commands need a separate permission so maker/checker is enforced
    // before the SoD matrix evaluates the transition.
    const writeReadPrefixes = [
      'SKILLS_TALENT', 'GLOBAL_HR', 'EMPLOYEE_RELATIONS', 'ENGAGEMENT',
      'CONTINGENT_WORKFORCE', 'UNION_LABOR', 'WELLBEING_EAP', 'HR_AI_GOVERNANCE',
      'DEI_ANALYTICS',
    ];
    if (writeReadPrefixes.includes(prefix)) {
      if (
        commandName.includes('GET') || commandName.includes('READ') ||
        commandName.includes('FIND') || commandName.includes('LIST')
      ) {
        return [`${prefix}_READ`];
      }
      if (commandName.includes('APPROVE') || commandName.includes('REJECT') || commandName.includes('UPHOLD')) {
        return [`${prefix}_APPROVE`];
      }
      return [`${prefix}_WRITE`];
    }

    switch (command.commandType) {
      case 'CREATE':
        perms.push(`${prefix}_CREATE`);
        break;
      case 'UPDATE':
        perms.push(`${prefix}_UPDATE`);
        break;
      case 'DELETE':
        perms.push(`${prefix}_DELETE`);
        break;
      case 'APPROVE':
        perms.push(`${prefix}_APPROVE`);
        break;
      case 'READ':
        perms.push(`${prefix}_READ`);
        break;
      default:
        perms.push(`${prefix}_READ`, `${prefix}_CREATE`, `${prefix}_UPDATE`);
    }
    return perms;
  }

  private mapAggregateTypeToPermissionPrefix(aggregateType: string): string {
    const mapping: Record<string, string> = {
      WorkerProfile: 'WORKER',
      EmploymentRelationship: 'WORKER',
      JobAssignment: 'WORKER',
      EmploymentContract: 'WORKER',
      PersonalDataRecord: 'WORKER',
      WorkSchedule: 'TIME',
      Timesheet: 'TIME',
      TimeClockEvent: 'TIME',
      AttendanceException: 'TIME',
      AttendanceCorrectionRequest: 'TIME',
      AttendanceDailyLedger: 'TIME',
      OvertimeApproval: 'TIME',
      ShiftSchedule: 'WORKFORCE',
      OpenShift: 'WORKFORCE',
      ShiftBid: 'WORKFORCE',
      ShiftSwapRequest: 'WORKFORCE',
      WfmOvertimeApproval: 'WORKFORCE',
      CoverageGap: 'WORKFORCE',
      AbsenceRequest: 'ABSENCE',
      LeaveCase: 'ABSENCE',
      AbsenceAccrualBalance: 'ABSENCE',
      LeaveEntitlementCalculation: 'ABSENCE',
      LeavePolicy: 'ABSENCE',
      PayrollCycle: 'PAYROLL',
      PayrollInput: 'PAYROLL',
      PayrollCalculationRun: 'PAYROLL',
      PayrollResultLine: 'PAYROLL',
      PayrollRun: 'PAYROLL',
      Payslip: 'PAYROLL',
      PayrollPaymentBatch: 'PAYROLL',
      PayrollGlPosting: 'PAYROLL',
      PayrollPayslipArtifact: 'PAYROLL',
      PayrollExportJob: 'PAYROLL',
      BenefitsProgram: 'BENEFITS',
      BenefitsEnrollment: 'BENEFITS',
      BenefitsLifeEvent: 'BENEFITS',
      SpendingAccount: 'BENEFITS',
      CarrierReconciliationRun: 'BENEFITS',
      HrServiceCase: 'SERVICE',
      HrCaseTask: 'SERVICE',
      HrKnowledgeArticle: 'SERVICE',
      HrServiceCatalogItem: 'SERVICE',
      HrCaseSlaInstance: 'SERVICE',
      CompensationBand: 'COMPENSATION',
      CompensationChange: 'COMPENSATION',
      CompensationPlan: 'COMPENSATION',
      PayScale: 'COMPENSATION',
      VariableCompPlan: 'COMPENSATION',
      TotalCompensationStatement: 'COMPENSATION',
      BonusCycle: 'COMPENSATION',
      EquityGrant: 'COMPENSATION',
      Requisition: 'RECRUITING',
      JobRequisition: 'RECRUITING',
      Candidate: 'RECRUITING',
      CandidateApplication: 'RECRUITING',
      Application: 'RECRUITING',
      Offer: 'RECRUITING',
      Interview: 'RECRUITING',
      LegalEntity: 'ORG',
      OrgUnit: 'ORG',
      OrganizationUnit: 'ORG',
      Department: 'ORG',
      BusinessUnit: 'ORG',
      ManagerRelationship: 'ORG',
      Position: 'POSITION',
      PerformanceReviewCycle: 'PERFORMANCE',
      PerformanceReview: 'PERFORMANCE',
      Goal: 'PERFORMANCE',
      PerformanceFeedback360Cycle: 'PERFORMANCE',
      PerformanceFeedback360Response: 'PERFORMANCE',
      Objective: 'PERFORMANCE',
      KeyResult: 'PERFORMANCE',
      KeyPerformanceIndicator: 'PERFORMANCE',
      KpiMeasurement: 'PERFORMANCE',
      ReviewTemplate: 'PERFORMANCE',
      Competency: 'PERFORMANCE',
      DevelopmentPlan: 'PERFORMANCE',
      CalibrationSession: 'PERFORMANCE',
      PerformanceImprovementPlan: 'PERFORMANCE',
      LearningCourse: 'LEARNING',
      LearningAssignment: 'LEARNING',
      LearningContentPackage: 'LEARNING',
      Certification: 'LEARNING',
      Course: 'LEARNING',
      PolicyDocument: 'COMPLIANCE',
      PolicyAcknowledgement: 'COMPLIANCE',
      CompliancePolicy: 'COMPLIANCE',
      LegalHold: 'COMPLIANCE',
      CountryPolicyPack: 'COMPLIANCE',
      StatutoryReport: 'COMPLIANCE',
      Report: 'REPORT',
      Dashboard: 'REPORT',
      Analytics: 'REPORT',
      ReportDefinition: 'REPORT',
      ReportExecution: 'REPORT',
      ReportSchedule: 'REPORT',
      CalculatedField: 'REPORT',
      // Skills & talent
      SkillProfile: 'SKILLS_TALENT',
      TalentPool: 'SKILLS_TALENT',
      CareerPath: 'SKILLS_TALENT',
      SuccessionPlan: 'SKILLS_TALENT',
      // Global HR
      CountryRuleSet: 'GLOBAL_HR',
      InternationalAssignment: 'GLOBAL_HR',
      StatutoryLeaveType: 'GLOBAL_HR',
      WorkAuthorizationCase: 'GLOBAL_HR',
      WorksCouncilConsultation: 'GLOBAL_HR',
      // Employee relations
      EmployeeRelationsCase: 'EMPLOYEE_RELATIONS',
      ErInvestigation: 'EMPLOYEE_RELATIONS',
      DisciplinaryAction: 'EMPLOYEE_RELATIONS',
      AccommodationCase: 'EMPLOYEE_RELATIONS',
      // Engagement
      EngagementSurvey: 'ENGAGEMENT',
      SurveyResponse: 'ENGAGEMENT',
      RecognitionProgram: 'ENGAGEMENT',
      RecognitionRecord: 'ENGAGEMENT',
      Feedback360Cycle: 'ENGAGEMENT',
      // Contingent workforce
      ContingentWorkerAssignment: 'CONTINGENT_WORKFORCE',
      ContractorRateCard: 'CONTINGENT_WORKFORCE',
      MisclassificationAssessment: 'CONTINGENT_WORKFORCE',
      SowEngagement: 'CONTINGENT_WORKFORCE',
      // Union & labor
      UnionRecognition: 'UNION_LABOR',
      CollectiveBargainingSession: 'UNION_LABOR',
      Grievance: 'UNION_LABOR',
      // Wellbeing & EAP
      WellnessProgram: 'WELLBEING_EAP',
      EapReferral: 'WELLBEING_EAP',
      MentalHealthCase: 'WELLBEING_EAP',
      // HR AI governance
      HrAiUseCase: 'HR_AI_GOVERNANCE',
      HrAiBiasTest: 'HR_AI_GOVERNANCE',
      HrAiModelRun: 'HR_AI_GOVERNANCE',
      HrAiKillSwitch: 'HR_AI_GOVERNANCE',
      // DEI analytics
      DeiReport: 'DEI_ANALYTICS',
      PayGapReport: 'DEI_ANALYTICS',
      PayEquityReview: 'DEI_ANALYTICS',
      AttritionSegmentReport: 'DEI_ANALYTICS',
      ApprovalChain: 'WORKFLOW',
      ApprovalStep: 'WORKFLOW',
      ApprovalDelegation: 'WORKFLOW',
    };
    return mapping[aggregateType] ?? aggregateType.toUpperCase();
  }

  private domainMatchesAggregate(domain: string, aggregateType: string): boolean {
    const mapping: Record<string, string[]> = {
      WORKER: ['Worker', 'Employee', 'Candidate', 'PersonalDataRecord'],
      ORG: ['Organization', 'OrgUnit', 'LegalEntity', 'Department', 'BusinessUnit', 'ManagerRelationship'],
      POSITION: ['Position', 'Job'],
      RECRUITING: ['Requisition', 'Candidate', 'Application', 'Offer', 'Interview'],
      PAYROLL: ['Payroll', 'PayrollRun', 'Payslip', 'PayrollCycle', 'PayrollInput'],
      BENEFITS: ['Benefit', 'BenefitsProgram', 'BenefitsEnrollment', 'Enrollment', 'Carrier', 'SpendingAccount'],
      COMPENSATION: ['Compensation', 'Salary', 'Bonus', 'Equity', 'CompensationChange'],
      PERFORMANCE: ['PerformanceReviewCycle', 'PerformanceReview', 'Goal', 'PerformanceFeedback360Cycle', 'PerformanceFeedback360Response', 'Objective', 'KeyResult', 'KeyPerformanceIndicator', 'KpiMeasurement', 'ReviewTemplate', 'Competency', 'DevelopmentPlan', 'CalibrationSession', 'PerformanceImprovementPlan'],
      LEARNING: ['Learning', 'Course', 'Certification'],
      ABSENCE: ['Absence', 'Leave', 'TimeOff'],
      TIME: ['Timesheet', 'TimeEntry'],
      WORKFORCE: ['ShiftSchedule', 'OpenShift', 'ShiftBid', 'ShiftSwapRequest', 'WfmOvertimeApproval', 'CoverageGap'],
      ER: ['ERCase', 'Investigation'],
      SERVICE: ['HrServiceCase', 'HrCaseTask', 'HrKnowledgeArticle', 'HrServiceCatalogItem', 'HrCaseSlaInstance', 'ServiceCatalog', 'ServiceCase'],
      COMPLIANCE: ['Compliance', 'Policy', 'LegalHold'],
      REPORT: ['Report', 'Analytics', 'Dashboard'],
      ADMIN: ['Tenant', 'System', 'Security'],
    };
    const aggregates = mapping[domain] ?? [];
    return aggregates.some((item) => aggregateType === item || aggregateType.includes(item));
  }

  private normalizeCommandName(commandName: string): string {
    return commandName
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s.-]+/g, '_')
      .toUpperCase();
  }

  private buildDenialReason(
    activeSelfServiceActor: boolean,
    rbacAllowed: boolean,
    selfServiceAllowed: boolean,
    sodResult: SodResult,
  ): string {
    const parts: string[] = [];
    if (!activeSelfServiceActor) parts.push('Inactive worker denied');
    if (!rbacAllowed) parts.push('RBAC denied');
    if (!selfServiceAllowed) parts.push('Self-service allowlist denied');
    if (sodResult.violated) parts.push(`SoD violated: ${sodResult.message}`);
    return parts.join('; ');
  }

  private isActiveSelfServiceActor(actor: HrActor): boolean {
    if (actor.actorType !== 'EMPLOYEE' && actor.actorType !== 'MANAGER') return true;
    if (!actor.employmentStatus) return false;
    return actor.employmentStatus === 'ACTIVE' || actor.employmentStatus === 'REHIRED';
  }
}
