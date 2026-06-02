import { Controller, Get, Optional, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FieldAccessDecision, FieldPolicyEngine, type AbacContext, type FieldDataClassification } from '@hcm/access-control';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from './guards/auth.guard.js';
import { FsmFramework } from './platform/workflow/fsm-framework.js';
import { WorkerRepository } from './domains/hr-core/repositories/worker.repository.js';
import { HcmSetupService } from './domains/hcm-setup/hcm-setup.service.js';
import type { AllowedActionPolicyOverride, FieldAccessPolicyOverride, HcmPolicyScope, PolicyGovernanceConfig } from './domains/hcm-setup/hcm-setup.types.js';

type AllowedActionDto = {
  id: string;
  label: string;
  action: string;
  requiresReason?: boolean;
};

type FieldAccessDto = {
  fieldPath: string;
  decision: 'VISIBLE' | 'MASKED' | 'HIDDEN' | 'REQUIRES_STEP_UP' | 'REQUIRES_BREAK_GLASS' | 'DENIED';
  maskingRule?: string;
  reason: string;
};

type ActorScopeClaims = {
  legalEntityIds?: string[];
  countryCodes?: string[];
  departmentIds?: string[];
  orgUnitIds?: string[];
  locationCodes?: string[];
  employeeTypes?: string[];
};

function labelForAction(action: string): string {
  return action
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const ACTION_FALLBACKS: Record<string, AllowedActionDto[]> = {
  WORKER: [
    { id: 'worker-view-profile', action: 'VIEW_PROFILE', label: 'View Profile' },
    { id: 'worker-update-contact', action: 'UPDATE_CONTACT', label: 'Update Contact' },
  ],
  WORKER_PROFILE: [
    { id: 'worker-profile-view-profile', action: 'VIEW_PROFILE', label: 'View Profile' },
    { id: 'worker-profile-update-contact', action: 'UPDATE_CONTACT', label: 'Update Contact' },
  ],
  ABSENCE: [
    { id: 'absence-submit-request', action: 'SUBMIT_REQUEST', label: 'Submit Leave Request' },
  ],
  BENEFITS: [
    { id: 'benefits-view-enrollments', action: 'VIEW_ENROLLMENTS', label: 'View Enrollments' },
    { id: 'benefits-update-elections', action: 'UPDATE_ELECTIONS', label: 'Update Elections' },
    { id: 'benefits-record-life-event', action: 'RECORD_LIFE_EVENT', label: 'Record Life Event' },
  ],
  BENEFITS_PROGRAM: [
    { id: 'benefits-program-create', action: 'CREATE_PROGRAM', label: 'Create Program' },
    { id: 'benefits-program-activate', action: 'ACTIVATE', label: 'Activate' },
    { id: 'benefits-program-suspend', action: 'SUSPEND', label: 'Suspend' },
  ],
  BENEFITS_ENROLLMENT: [
    { id: 'benefits-enrollment-submit', action: 'SUBMIT', label: 'Submit' },
    { id: 'benefits-enrollment-approve', action: 'APPROVE', label: 'Approve' },
    { id: 'benefits-enrollment-reject', action: 'REJECT', label: 'Reject' },
  ],
  ORG: [
    { id: 'org-create-unit', action: 'CREATE_UNIT', label: 'Create Unit' },
    { id: 'org-create-legal-entity', action: 'CREATE_LEGAL_ENTITY', label: 'Create Legal Entity' },
    { id: 'org-assign-manager', action: 'ASSIGN_MANAGER', label: 'Assign Manager' },
  ],
  ORG_UNIT: [
    { id: 'org-unit-create', action: 'CREATE_UNIT', label: 'Create Unit' },
    { id: 'org-unit-update', action: 'UPDATE_UNIT', label: 'Update Unit' },
    { id: 'org-unit-assign-manager', action: 'ASSIGN_MANAGER', label: 'Assign Manager' },
  ],
  LEGAL_ENTITY: [
    { id: 'legal-entity-create', action: 'CREATE_LEGAL_ENTITY', label: 'Create Legal Entity' },
    { id: 'legal-entity-update', action: 'UPDATE_LEGAL_ENTITY', label: 'Update Legal Entity' },
  ],
  TIME_CLOCK_EVENT: [
    { id: 'time-clock-event-validate', action: 'VALIDATE', label: 'Validate' },
    { id: 'time-clock-event-resolve', action: 'RESOLVE', label: 'Resolve' },
  ],
  PAYROLL: [
    { id: 'payroll-create-cycle', action: 'CREATE_CYCLE', label: 'Create Cycle' },
    { id: 'payroll-run-preview', action: 'RUN_PREVIEW', label: 'Run Preview' },
    { id: 'payroll-approve', action: 'APPROVE', label: 'Approve' },
  ],
  PERFORMANCE: [
    { id: 'performance-create-review', action: 'CREATE_REVIEW', label: 'Create Review' },
    { id: 'performance-request-feedback', action: 'REQUEST_FEEDBACK', label: 'Request Feedback' },
  ],
  COMPLIANCE: [
    { id: 'compliance-create-policy', action: 'CREATE_POLICY', label: 'Create Policy' },
    { id: 'compliance-require-ack', action: 'REQUIRE_ACKNOWLEDGEMENT', label: 'Require Acknowledgement' },
  ],
  COUNTRY_POLICY: [
    { id: 'country-policy-validate', action: 'VALIDATE', label: 'Validate' },
    { id: 'country-policy-simulate', action: 'SIMULATE', label: 'Simulate' },
    { id: 'country-policy-approve', action: 'APPROVE', label: 'Approve' },
    { id: 'country-policy-publish', action: 'PUBLISH', label: 'Publish' },
  ],
};

const AGGREGATE_ALIASES: Record<string, string> = {
  WORKER: 'WorkerProfile',
  WORKER_PROFILE: 'WorkerProfile',
  ABSENCE_REQUEST: 'AbsenceRequest',
  TIME_CLOCK_EVENT: 'TimeClockEvent',
  LEGAL_ENTITY: 'LegalEntity',
  ORG_UNIT: 'OrgUnit',
  ORGANIZATION: 'OrgUnit',
  BENEFITS: 'BenefitsEnrollment',
  BENEFITS_PROGRAM: 'BenefitsProgram',
  BENEFITS_ENROLLMENT: 'BenefitsEnrollment',
  PAYROLL: 'PayrollCycle',
  PERFORMANCE: 'PerformanceReview',
  COUNTRY_POLICY: 'CountryPolicyPack',
};

const FIELD_DECISION_MAP: Record<FieldAccessDecision, FieldAccessDto['decision']> = {
  [FieldAccessDecision.VISIBLE]: 'VISIBLE',
  [FieldAccessDecision.MASKED]: 'MASKED',
  [FieldAccessDecision.HIDDEN]: 'HIDDEN',
  [FieldAccessDecision.REQUIRES_STEP_UP]: 'REQUIRES_STEP_UP',
  [FieldAccessDecision.REQUIRES_BREAK_GLASS]: 'REQUIRES_BREAK_GLASS',
  [FieldAccessDecision.DENIED_SPECIAL_CATEGORY]: 'DENIED',
  [FieldAccessDecision.DENIED_NO_BUSINESS_NEED]: 'DENIED',
};

const FIELD_CLASSIFICATION_DEFAULTS: Array<{ pattern: RegExp; classification: FieldDataClassification }> = [
  { pattern: /(ssn|medical|diversity)/i, classification: 'SPECIAL_CATEGORY' },
  { pattern: /(salary|compensation|bank|pay|benefit)/i, classification: 'HIGH_SENSITIVITY' },
  { pattern: /(legalHold|legal_hold)/i, classification: 'LEGAL_HOLD' },
];

const HR_POLICY_ROLES = new Set(['HR_ADMIN', 'HRBP', 'PAYROLL_ADMIN', 'BENEFITS_ADMIN', 'COMPLIANCE_OFFICER', 'SUPER_ADMIN']);
const EMPLOYEE_SELF_SERVICE_ACTIONS = new Set([
  'VIEW_PROFILE',
  'UPDATE_CONTACT',
  'SUBMIT_REQUEST',
  'VIEW_ENROLLMENTS',
  'UPDATE_ELECTIONS',
  'RECORD_LIFE_EVENT',
]);
const MANAGER_POLICY_ACTIONS = new Set([
  ...EMPLOYEE_SELF_SERVICE_ACTIONS,
  'VIEW_PROFILE',
  'APPROVE',
  'REJECT',
  'VALIDATE',
  'RESOLVE',
  'REQUEST_FEEDBACK',
]);

function normalizeClassification(value: string | undefined, fieldPath: string): FieldDataClassification {
  if (value === 'LOW' || value === 'CONFIDENTIAL' || value === 'HIGH_SENSITIVITY' || value === 'SPECIAL_CATEGORY' || value === 'LEGAL_HOLD') {
    return value;
  }

  return FIELD_CLASSIFICATION_DEFAULTS.find((entry) => entry.pattern.test(fieldPath))?.classification ?? 'LOW';
}

@ApiTags('Policy Actions')
@UseGuards(AuthGuard)
@Controller('policy')
export class PolicyActionsController {
  private readonly fieldPolicyEngine = new FieldPolicyEngine();

  constructor(
    private readonly fsm: FsmFramework,
    private readonly workerRepo: WorkerRepository,
    @Optional() private readonly hcmSetup?: Pick<HcmSetupService, 'getSetup'>,
  ) {}

  @Get('allowed-actions')
  async getAllowedActions(
    @Query('aggregateType') aggregateType: string,
    @Query('state') state?: string,
    @Query('aggregateId') aggregateId?: string,
    @Query('subjectWorkerId') subjectWorkerId?: string,
    @Req() req?: Request,
  ): Promise<AllowedActionDto[]> {
    const normalizedType = (aggregateType ?? '').trim().toUpperCase();
    const fsmAggregateType = AGGREGATE_ALIASES[normalizedType] ?? aggregateType;
    const actions = state ? this.fsm.getAllowedActionsFromState(state, fsmAggregateType) : [];

    const candidates = actions.length > 0
      ? actions.map((action) => ({
        id: `${normalizedType || fsmAggregateType}-${action}`.toLowerCase(),
        action,
        label: labelForAction(action),
      }))
      : ACTION_FALLBACKS[normalizedType] ?? [];

    const filtered = this.filterActionsForActor(candidates, normalizedType, req, {
      aggregateId,
      subjectWorkerId,
    });
    const governance = await this.getRuntimeGovernance(req);
    return this.applyAllowedActionOverrides(filtered, normalizedType, governance, req, {
      aggregateId,
      subjectWorkerId,
    });
  }

  @Get('field-access')
  async getFieldAccess(
    @Query('fieldPath') fieldPath: string,
    @Query('resourceType') resourceType: string,
    @Query('resourceId') resourceId: string | undefined,
    @Query('dataClassification') dataClassification: string | undefined,
    @Req() req: Request,
  ): Promise<FieldAccessDto> {
    const actorRoles = req.actor?.roles ?? [];
    const scopeClaims = req.actor as (typeof req.actor & ActorScopeClaims) | undefined;
    const subjectWorkerId = resourceId && Uuid.isValid(resourceId) ? new Uuid(resourceId) : undefined;
    const isSelf = await this.isSelfWorkerResource(req, subjectWorkerId);
    const abacContext: AbacContext = {
      subjectWorkerId,
      actorWorkerId: req.actor?.actorId,
      isSelf,
      isManager: actorRoles.includes('MANAGER'),
      isManagerChain: actorRoles.includes('MANAGER'),
      isPeer: false,
      legalEntityIds: scopeClaims?.legalEntityIds ?? [],
      countryCodes: scopeClaims?.countryCodes ?? [],
      departmentIds: scopeClaims?.departmentIds ?? [],
      timeOfAccess: new Date(),
      breakGlassActive: Boolean(req.actor?.breakGlassSessionId),
      mfaAuthenticated: req.actor?.mfaAuthenticated ?? false,
    };
    const evaluation = this.fieldPolicyEngine.evaluateFieldAccess(
      fieldPath,
      actorRoles,
      abacContext,
      normalizeClassification(dataClassification, fieldPath),
    );

    const decision: FieldAccessDto = {
      fieldPath: evaluation.fieldPath,
      decision: FIELD_DECISION_MAP[evaluation.decision],
      maskingRule: evaluation.decision === FieldAccessDecision.MASKED ? evaluation.maskingRule : undefined,
      reason: `Field access policy evaluated for ${fieldPath} on ${resourceType || 'resource'}.`,
    };

    const governance = await this.getRuntimeGovernance(req);
    return this.applyFieldAccessOverrides(decision, resourceType, actorRoles, governance, req);
  }

  private filterActionsForActor(
    actions: AllowedActionDto[],
    aggregateType: string,
    req: Request | undefined,
    scope: { aggregateId?: string; subjectWorkerId?: string },
  ): AllowedActionDto[] {
    if (!req?.actor || !req.tenantId) {
      return [];
    }

    const roles = req.actor.roles ?? [];
    if (roles.some((role) => HR_POLICY_ROLES.has(role))) {
      return actions;
    }

    if (roles.includes('MANAGER')) {
      return actions.filter((action) => MANAGER_POLICY_ACTIONS.has(action.action));
    }

    if (roles.includes('EMPLOYEE')) {
      const scopedToSelf = this.isSelfScope(req, scope.subjectWorkerId ?? scope.aggregateId);
      return actions.filter((action) => {
        if (!EMPLOYEE_SELF_SERVICE_ACTIONS.has(action.action)) {
          return false;
        }
        if ((aggregateType === 'WORKER' || aggregateType === 'WORKER_PROFILE') && action.action !== 'VIEW_PROFILE') {
          return scopedToSelf;
        }
        return true;
      });
    }

    return actions.filter((action) => {
      if (aggregateType === 'WORKER' || aggregateType === 'WORKER_PROFILE') {
        return action.action === 'VIEW_PROFILE';
      }
      return false;
    });
  }

  private isSelfScope(req: Request, workerId: string | undefined): boolean {
    const actorId = req.actor?.actorId?.value;
    return Boolean(workerId && actorId && workerId === actorId);
  }

  private async isSelfWorkerResource(req: Request, subjectWorkerId: Uuid | undefined): Promise<boolean> {
    if (!subjectWorkerId || !req.tenantId || !Uuid.isValid(req.tenantId)) {
      return false;
    }

    const tenantId = new Uuid(req.tenantId);
    const actorId = req.actor?.actorId?.value;
    if (actorId && Uuid.isValid(actorId)) {
      const actorWorker = await this.workerRepo.findByIdForTenant(new Uuid(actorId), tenantId);
      if (actorWorker?.id.value === subjectWorkerId.value) {
        return true;
      }
    }

    const actorEmail = req.actor?.email;
    if (actorEmail) {
      const actorWorker = await this.workerRepo.findByEmailForTenant(actorEmail, tenantId);
      if (actorWorker?.id.value === subjectWorkerId.value) {
        return true;
      }
    }

    return false;
  }

  private async getRuntimeGovernance(req?: Request): Promise<PolicyGovernanceConfig | undefined> {
    if (!this.hcmSetup || !req?.tenantId || !Uuid.isValid(req.tenantId)) {
      return undefined;
    }
    try {
      const setup = await this.hcmSetup.getSetup(new Uuid(req.tenantId));
      return setup.policyGovernance;
    } catch {
      return undefined;
    }
  }

  private applyAllowedActionOverrides(
    actions: AllowedActionDto[],
    aggregateType: string,
    governance: PolicyGovernanceConfig | undefined,
    req: Request | undefined,
    scope: { aggregateId?: string; subjectWorkerId?: string },
  ): AllowedActionDto[] {
    if (!governance?.allowedActionOverrides?.length || !req) return actions;

    return actions
      .map((action) => {
        const override = governance.allowedActionOverrides.find((candidate) => this.allowedActionOverrideMatches(candidate, aggregateType, action, req, scope));
        if (!override) return action;
        if (override.effect === 'HIDE') return undefined;
        return {
          ...action,
          label: override.label ?? action.label,
          requiresReason: override.requiresReason ?? action.requiresReason,
        };
      })
      .filter((action): action is AllowedActionDto => Boolean(action));
  }

  private allowedActionOverrideMatches(
    override: AllowedActionPolicyOverride,
    aggregateType: string,
    action: AllowedActionDto,
    req: Request,
    actionScope: { aggregateId?: string; subjectWorkerId?: string },
  ): boolean {
    return Boolean(
      override.active
      && normalizeAggregateType(override.aggregateType) === normalizeAggregateType(aggregateType)
      && override.action === action.action
      && this.rolesMatch(override.roles, req.actor?.roles ?? [])
      && this.scopeMatches(override.scope, req, actionScope),
    );
  }

  private applyFieldAccessOverrides(
    decision: FieldAccessDto,
    resourceType: string,
    roles: string[],
    governance: PolicyGovernanceConfig | undefined,
    req: Request,
  ): FieldAccessDto {
    const override = governance?.fieldAccessOverrides?.find((candidate) => this.fieldAccessOverrideMatches(candidate, decision.fieldPath, resourceType, roles, req));
    if (!override) return decision;

    return {
      fieldPath: decision.fieldPath,
      decision: override.decision,
      maskingRule: override.decision === 'MASKED' ? override.maskingRule : undefined,
      reason: override.reason ?? decision.reason,
    };
  }

  private fieldAccessOverrideMatches(
    override: FieldAccessPolicyOverride,
    fieldPath: string,
    resourceType: string,
    roles: string[],
    req: Request,
  ): boolean {
    return Boolean(
      override.active
      && override.fieldPath === fieldPath
      && normalizeAggregateType(override.resourceType) === normalizeAggregateType(resourceType)
      && this.rolesMatch(override.roles, roles)
      && this.scopeMatches(override.scope, req, { aggregateId: undefined, subjectWorkerId: undefined }),
    );
  }

  private rolesMatch(policyRoles: string[] | undefined, actorRoles: string[]): boolean {
    if (!policyRoles || policyRoles.length === 0) return true;
    const actorRoleSet = new Set(actorRoles);
    return policyRoles.some((role) => actorRoleSet.has(role));
  }

  private scopeMatches(scope: HcmPolicyScope | undefined, req: Request, actionScope: { aggregateId?: string; subjectWorkerId?: string }): boolean {
    if (!scope) return true;
    const now = Date.now();
    if (scope.effectiveFrom && new Date(`${scope.effectiveFrom}T00:00:00.000Z`).getTime() > now) return false;
    if (scope.effectiveUntil && new Date(`${scope.effectiveUntil}T23:59:59.999Z`).getTime() < now) return false;

    const actorScope = req.actor as (typeof req.actor & ActorScopeClaims) | undefined;
    const actorId = req.actor?.actorId?.value;
    return this.claimsMatch(scope.countryCodes, actorScope?.countryCodes)
      && this.claimsMatch(scope.legalEntityIds, actorScope?.legalEntityIds)
      && this.claimsMatch(scope.orgUnitIds, actorScope?.orgUnitIds)
      && this.claimsMatch(scope.departmentIds, actorScope?.departmentIds)
      && this.claimsMatch(scope.locationCodes, actorScope?.locationCodes)
      && this.claimsMatch(scope.employeeTypes, actorScope?.employeeTypes)
      && this.workerScopeMatches(scope.workerIds, actorId, actionScope);
  }

  private claimsMatch(policyValues: string[] | undefined, actorValues: string[] | undefined): boolean {
    if (!policyValues || policyValues.length === 0) return true;
    const actorSet = new Set(actorValues ?? []);
    return policyValues.some((value) => actorSet.has(value));
  }

  private workerScopeMatches(policyWorkerIds: string[] | undefined, actorId: string | undefined, actionScope: { aggregateId?: string; subjectWorkerId?: string }): boolean {
    if (!policyWorkerIds || policyWorkerIds.length === 0) return true;
    return policyWorkerIds.some((workerId) => (
      workerId === actorId
      || workerId === actionScope.subjectWorkerId
      || workerId === actionScope.aggregateId
    ));
  }
}

function normalizeAggregateType(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
}
