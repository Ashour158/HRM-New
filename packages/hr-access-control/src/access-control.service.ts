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

    const allowed = rbacAllowed && selfServiceAllowed && !sodResult.violated;

    return {
      allowed,
      rbacAllowed,
      abacAllowed: true, // command-level ABAC is evaluated downstream
      sodAllowed: !sodResult.violated,
      selfServiceAllowed,
      requiresApproval,
      reason: allowed
        ? undefined
        : this.buildDenialReason(rbacAllowed, selfServiceAllowed, sodResult),
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
    };
    return mapping[aggregateType] ?? aggregateType.toUpperCase();
  }

  private domainMatchesAggregate(domain: string, aggregateType: string): boolean {
    const mapping: Record<string, string[]> = {
      WORKER: ['Worker', 'Employee', 'Candidate'],
      ORG: ['Organization', 'Department', 'BusinessUnit'],
      POSITION: ['Position', 'Job'],
      RECRUITING: ['Requisition', 'Candidate', 'Application'],
      PAYROLL: ['Payroll', 'PayrollRun', 'Payslip'],
      BENEFITS: ['Benefit', 'Enrollment', 'Carrier'],
      COMPENSATION: ['Compensation', 'Salary', 'Bonus', 'Equity'],
      PERFORMANCE: ['PerformanceReview', 'Goal'],
      LEARNING: ['Learning', 'Course', 'Certification'],
      ABSENCE: ['Absence', 'Leave', 'TimeOff'],
      TIME: ['Timesheet', 'TimeEntry'],
      ER: ['ERCase', 'Investigation'],
      COMPLIANCE: ['Compliance', 'Policy', 'LegalHold'],
      REPORT: ['Report', 'Analytics', 'Dashboard'],
      ADMIN: ['Tenant', 'System', 'Security'],
    };
    const aggregates = mapping[domain] ?? [];
    return aggregates.includes(aggregateType);
  }

  private buildDenialReason(
    rbacAllowed: boolean,
    selfServiceAllowed: boolean,
    sodResult: SodResult,
  ): string {
    const parts: string[] = [];
    if (!rbacAllowed) parts.push('RBAC denied');
    if (!selfServiceAllowed) parts.push('Self-service allowlist denied');
    if (sodResult.violated) parts.push(`SoD violated: ${sodResult.message}`);
    return parts.join('; ');
  }
}
