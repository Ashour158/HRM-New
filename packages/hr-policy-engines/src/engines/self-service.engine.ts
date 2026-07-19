import { randomUUID } from 'node:crypto';
import { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from '../core/decision-record.js';
import type { EngineContext, PolicyEngine, PolicyEngineDefinition } from '../core/engine-definition.js';

/**
 * Decision codes emitted by the Self-Service Authority Engine.
 */
export type SelfServiceAllowlistDecisionCode =
  | 'ALLOWED'
  | 'REQUIRES_APPROVAL'
  | 'FORBIDDEN';

/**
 * Input payload for the Self-Service Authority Engine.
 */
export interface SelfServiceAuthorityInput {
  readonly actorType: string;
  readonly commandName: string;
  readonly actorRoles: string[];
  readonly abacContext: Record<string, unknown>;
}

/**
 * Self-Service Authority Engine.
 *
 * Decides whether a self-service command initiated by an employee,
 * manager, or administrator is allowed, requires approval, or is
 * forbidden. Consumes the `employee-self-service-rules` rule pack.
 */
export class SelfServiceAuthorityEngine implements PolicyEngine<SelfServiceAuthorityInput, DecisionRecord> {
  readonly definition: PolicyEngineDefinition = {
    engineName: 'self-service-authority',
    engineVersion: '1.4.0',
    description:
      'Determines if a self-service action is permitted, requires elevated approval, '
      + 'or is forbidden based on actor role and ABAC context.',
    inputTypes: ['ActorType', 'CommandName', 'ActorRole', 'AbacContext'],
    outputDecisionCodes: ['ALLOWED', 'REQUIRES_APPROVAL', 'FORBIDDEN'],
    associatedRulePacks: ['employee-self-service-rules'],
    associatedTables: ['self_service_rules', 'actor_roles', 'approval_workflows'],
    invocationPattern: 'SYNC',
    maxDurationMs: 100,
    requiresCountryPolicyPack: false,
    requiresHumanReview: false,
    auditRequired: true,
  };

  async execute(
    input: SelfServiceAuthorityInput,
    context: EngineContext,
  ): Promise<DecisionRecord> {
    const decision = evaluateSelfServiceDecision(input);

    const record: DecisionRecord = {
      decisionId: new Uuid(randomUUID()),
      decisionCode: decision.decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'employee-self-service-rules',
      ruleSetVersion: '1.0.0',
      explanation: decision.explanation,
      sourceInputIds: [input.commandName],
      inputSnapshotHash: '<SHA-256>',
      timestamp: new Date(),
      tenantId: context.tenantId,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveDate: context.effectiveDate,
    };

    return record;
  }
}

function evaluateSelfServiceDecision(input: SelfServiceAuthorityInput): {
  decisionCode: SelfServiceAllowlistDecisionCode;
  explanation: string;
} {
  const actorType = input.actorType.toUpperCase();
  const roles = new Set(input.actorRoles.map((role) => role.toUpperCase()));
  const aggregateType = String(input.abacContext.aggregateType ?? '').toUpperCase();
  const commandType = String(input.abacContext.commandType ?? '').toUpperCase();
  const commandName = input.commandName.toUpperCase();

  if (actorType === 'SYSTEM' || actorType === 'INTEGRATION' || hasAnyRole(roles, ADMIN_ROLES)) {
    return allowed(input, 'privileged actor is allowed to execute administrative service commands');
  }

  if (ADMIN_ONLY_AGGREGATES.has(aggregateType)) {
    return forbidden(input, 'not allowed for employee or manager self-service actors without an administrative role');
  }

  if (actorType === 'MANAGER') {
    if (MANAGER_SERVICE_AGGREGATES.has(aggregateType) || EMPLOYEE_SELF_SERVICE_AGGREGATES.has(aggregateType)) {
      return allowed(input, 'manager-scoped service command is allowed and remains subject to manager relationship checks');
    }
    return forbidden(input, 'not allowed because the aggregate is outside manager self-service scope');
  }

  if (isAdministrativeCommand(commandName, commandType)) {
    return forbidden(input, 'not allowed for employee or manager self-service actors without an administrative role');
  }

  if (actorType === 'EMPLOYEE') {
    if (EMPLOYEE_SELF_SERVICE_AGGREGATES.has(aggregateType)) {
      return allowed(input, 'employee self-service command is allowed for the requested aggregate');
    }
    return forbidden(input, 'not allowed because the aggregate is outside employee self-service scope');
  }

  return forbidden(input, 'not allowed for the actor type without an explicit self-service rule');
}

function allowed(input: SelfServiceAuthorityInput, reason: string) {
  return {
    decisionCode: 'ALLOWED' as const,
    explanation:
      `Self-service command "${input.commandName}" evaluated for actor type "${input.actorType}". `
      + `Result: ALLOWED; ${reason}.`,
  };
}

function forbidden(input: SelfServiceAuthorityInput, reason: string) {
  return {
    decisionCode: 'FORBIDDEN' as const,
    explanation:
      `Self-service command "${input.commandName}" evaluated for actor type "${input.actorType}". `
      + `Result: FORBIDDEN; ${reason}.`,
  };
}

function hasAnyRole(roles: Set<string>, allowedRoles: ReadonlySet<string>): boolean {
  for (const role of roles) {
    if (allowedRoles.has(role)) return true;
  }
  return false;
}

function isAdministrativeCommand(commandName: string, commandType: string): boolean {
  if (['APPROVE', 'DELETE'].includes(commandType)) return true;
  return ADMIN_COMMAND_PATTERNS.some((pattern) => pattern.test(commandName));
}

const ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'PAYROLL_ADMIN',
  'COMPENSATION_ADMIN',
  'BENEFITS_ADMIN',
  'COMPLIANCE_OFFICER',
  'LEGAL',
  'WORKFORCE_PLANNING_ADMIN',
]);

const EMPLOYEE_SELF_SERVICE_AGGREGATES = new Set([
  'ABSENCEREQUEST',
  'LEAVECASE',
  'TIMECLOCKEVENT',
  'ATTENDANCECORRECTIONREQUEST',
  'HRSERVICECASE',
  'ONBOARDINGTASK',
  'WORKERPROFILE',
  'BENEFITSENROLLMENT',
  'BENEFITSLIFEEVENT',
  'POLICYACKNOWLEDGEMENT',
  'LEARNINGASSIGNMENT',
  'SURVEYRESPONSE',
  'PERFORMANCEFEEDBACK360RESPONSE',
  'PERFORMANCEREVIEW',
  'GOAL',
  'OBJECTIVE',
]);

const MANAGER_SERVICE_AGGREGATES = new Set([
  'ABSENCEREQUEST',
  'ATTENDANCECORRECTIONREQUEST',
  'TIMESHEET',
  'OVERTIMEAPPROVAL',
  'PERFORMANCEREVIEW',
  'PERFORMANCEIMPROVEMENTPLAN',
  'DEVELOPMENTPLAN',
  'GOAL',
  'OBJECTIVE',
  'HRSERVICECASE',
]);

const ADMIN_ONLY_AGGREGATES = new Set([
  'PAYROLLCYCLE',
  'PAYROLLINPUT',
  'PAYROLLCALCULATIONRUN',
  'PAYROLLPAYMENTBATCH',
  'PAYROLLRESULTLINE',
  'COMPENSATIONPLAN',
  'COMPENSATIONBAND',
  'COMPENSATIONCHANGE',
  'BONUSCYCLE',
  'EQUITYGRANT',
  'VARIABLECOMPPLAN',
  'PAYSCALE',
  'LEGALENTITY',
  'ORGUNIT',
  'COUNTRYPOLICYPACK',
  'POLICYDOCUMENT',
  'LEGALHOLD',
  'STATUTORYREPORT',
]);

const ADMIN_COMMAND_PATTERNS = [
  /APPROVE/,
  /REJECT/,
  /PUBLISH/,
  /APPLY/,
  /FINALIZE/,
  /(^|_)LOCK($|_)/,
  /(^|_)UNLOCK($|_)/,
  /SUSPEND/,
  /TERMINATE/,
  /ACTIVATE/,
  /DEACTIVATE/,
  /ASSIGNMANAGER/,
  /RUNPAYROLL/,
  /POSTGL/,
  /CREATELEGALENTITY/,
  /CREATEORGUNIT/,
];
