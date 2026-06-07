import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AuditLedgerService } from '@hcm/platform-core';
import { Uuid } from '@hcm/shared-kernel';
import { createPrivacyForEvent, type HrEventEnvelope } from '@hcm/event-schemas';
import { createHash } from 'node:crypto';
import { PlatformNotificationRepository } from '../../platform/notifications/platform-notification.repository.js';
import { OutboxPublisher } from '../../platform/outbox-inbox/outbox-publisher.js';
import { HcmSetupService } from '../hcm-setup/hcm-setup.service.js';
import type {
  AttendanceDeviceTrustRule,
  AttendanceFlexibleHoursRule,
  AttendanceGeofenceProfile,
  AttendancePolicy,
  AttendanceShiftRotationRule,
  DeductionPolicy,
  EarningPolicy,
  HcmSetupConfig,
  HcmSetupUpdate,
  LeavePolicy,
  PayrollBlockingRule,
  StatutoryPayrollPack,
} from '../hcm-setup/hcm-setup.types.js';
import { PolicyCenterRepository } from './policy-center.repository.js';
import type {
  CreatePolicyRevisionInput,
  PolicyActor,
  PolicyArea,
  PolicyCenterRepositoryPort,
  PolicyImpactSimulationResult,
  PolicyRevisionRecord,
  PolicyRevisionStatus,
  PolicyScope,
  PolicyValidationResult,
  UpdatePolicyRevisionInput,
} from './policy-center.types.js';

const ENGINE_VERSION = '1.0.0';
const LIFECYCLE_EVENT_NAMES: Record<PolicyRevisionStatus, string> = {
  DRAFT: 'PolicyRevisionDrafted',
  IN_REVIEW: 'PolicyRevisionSubmittedForReview',
  REVIEWED: 'PolicyRevisionReviewed',
  APPROVED: 'PolicyRevisionApproved',
  PUBLISHED: 'PolicyRevisionPublished',
  APPLIED: 'PolicyRevisionApplied',
  REJECTED: 'PolicyRevisionRejected',
  ARCHIVED: 'PolicyRevisionArchived',
};

const AREA_NOTIFICATION_TITLES: Record<PolicyArea, string> = {
  EMPLOYEE_SETUP: 'Employee setup policy changed',
  LEAVE: 'Leave policy changed',
  ATTENDANCE: 'Attendance policy changed',
  PAYROLL: 'Payroll policy changed',
  ACCESS_GOVERNANCE: 'Access policy changed',
  COUNTRY_POLICY: 'Country policy changed',
  COMPLIANCE: 'Compliance policy changed',
};

type ScopedPolicy =
  | LeavePolicy
  | StatutoryPayrollPack
  | EarningPolicy
  | DeductionPolicy
  | PayrollBlockingRule
  | AttendanceShiftRotationRule
  | AttendanceGeofenceProfile
  | AttendanceDeviceTrustRule
  | AttendanceFlexibleHoursRule;

type PolicyLifecycleEvidenceInput = {
  revision: PolicyRevisionRecord;
  actor: PolicyActor;
  eventName: string;
  fromStatus: PolicyRevisionStatus | 'INITIAL';
  toStatus: PolicyRevisionStatus;
  payload?: Record<string, unknown>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function nonEmpty(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function sameSet(left: string[] | undefined, right: string[] | undefined): boolean {
  const a = new Set(nonEmpty(left));
  const b = new Set(nonEmpty(right));
  if (a.size !== b.size) return false;
  return [...a].every((value) => b.has(value));
}

function intersects(left: string[] | undefined, right: string[] | undefined): boolean {
  const a = nonEmpty(left);
  const b = new Set(nonEmpty(right));
  return a.length > 0 && a.some((value) => b.has(value));
}

function effectiveWindowOverlaps(left: PolicyScope, right: PolicyScope): boolean {
  const leftStart = left.effectiveFrom ? new Date(`${left.effectiveFrom}T00:00:00.000Z`).getTime() : Number.NEGATIVE_INFINITY;
  const rightStart = right.effectiveFrom ? new Date(`${right.effectiveFrom}T00:00:00.000Z`).getTime() : Number.NEGATIVE_INFINITY;
  const leftEnd = left.effectiveUntil ? new Date(`${left.effectiveUntil}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY;
  const rightEnd = right.effectiveUntil ? new Date(`${right.effectiveUntil}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function scopePrecedence(scope: PolicyScope): number {
  if (nonEmpty(scope.workerIds).length > 0) return 5;
  if (nonEmpty(scope.departmentIds).length > 0 || nonEmpty(scope.orgUnitIds).length > 0) return 4;
  if (nonEmpty(scope.legalEntityIds).length > 0) return 3;
  if (nonEmpty(scope.countryCodes).length > 0) return 2;
  return 1;
}

function scopesTargetSameAudience(left: PolicyScope, right: PolicyScope): boolean {
  const rank = scopePrecedence(left);
  if (rank !== scopePrecedence(right)) return false;
  if (rank === 5) return intersects(left.workerIds, right.workerIds);
  if (rank === 4) {
    return intersects(left.departmentIds, right.departmentIds)
      || intersects(left.orgUnitIds, right.orgUnitIds)
      || (sameSet(left.departmentIds, right.departmentIds) && sameSet(left.orgUnitIds, right.orgUnitIds));
  }
  if (rank === 3) return intersects(left.legalEntityIds, right.legalEntityIds);
  if (rank === 2) return intersects(left.countryCodes, right.countryCodes);
  return true;
}

function normalizedScope(tenantId: Uuid, scope?: Partial<PolicyScope>): PolicyScope {
  return {
    tenantId: scope?.tenantId ?? tenantId.value,
    countryCodes: nonEmpty(scope?.countryCodes),
    legalEntityIds: nonEmpty(scope?.legalEntityIds),
    orgUnitIds: nonEmpty(scope?.orgUnitIds),
    departmentIds: nonEmpty(scope?.departmentIds),
    locationCodes: nonEmpty(scope?.locationCodes),
    employeeTypes: nonEmpty(scope?.employeeTypes),
    workerIds: nonEmpty(scope?.workerIds),
    effectiveFrom: scope?.effectiveFrom,
    effectiveUntil: scope?.effectiveUntil,
  };
}

function extractBaselineConfig(area: PolicyArea, setup: HcmSetupConfig): Partial<HcmSetupConfig> | Record<string, unknown> {
  if (area === 'LEAVE') return { leavePolicies: setup.leavePolicies };
  if (area === 'ATTENDANCE') return { attendancePolicy: setup.attendancePolicy };
  if (area === 'PAYROLL') {
    return {
      payrollCalculationPolicy: setup.payrollCalculationPolicy,
      statutoryPayrollPacks: setup.statutoryPayrollPacks,
      earningPolicies: setup.earningPolicies,
      deductionPolicies: setup.deductionPolicies,
      payrollBlockingRules: setup.payrollBlockingRules,
    };
  }
  if (area === 'ACCESS_GOVERNANCE') return { policyGovernance: setup.policyGovernance ?? { allowedActionOverrides: [], fieldAccessOverrides: [] } };
  if (area === 'EMPLOYEE_SETUP') {
    return {
      genderOptions: setup.genderOptions,
      locations: setup.locations,
      cities: setup.cities,
      departments: setup.departments,
      jobTitles: setup.jobTitles,
      employeeIdPolicy: setup.employeeIdPolicy,
      socialMediaFields: setup.socialMediaFields,
      documentRequirements: setup.documentRequirements,
      fieldRules: setup.fieldRules,
    };
  }
  return area === 'COUNTRY_POLICY'
    ? { countryPolicyRuntime: setup.countryPolicyRuntime ?? {} }
    : { compliancePolicyRuntime: setup.compliancePolicyRuntime ?? {} };
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function collectPolicyCodes(value: unknown, key: string): string[] {
  const records = asObject(value)[key];
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => asObject(record).code)
    .filter((code): code is string => typeof code === 'string' && code.trim().length > 0)
    .map((code) => code.trim().toUpperCase());
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function replacementRevisionId(revision: PolicyRevisionRecord): string | undefined {
  const replacement = asObject(asObject(revision.draftConfig).policyReplacement);
  const value = replacement.replacesRevisionId;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function withScope<T extends ScopedPolicy>(policy: T, scope: PolicyScope): T {
  const existing = policy as Record<string, unknown>;
  return {
    ...policy,
    employeeTypes: nonEmpty(scope.employeeTypes).length > 0 ? nonEmpty(scope.employeeTypes) : existing.employeeTypes,
    departmentCodes: nonEmpty(scope.departmentIds).length > 0 ? nonEmpty(scope.departmentIds) : existing.departmentCodes,
    locationCodes: nonEmpty(scope.locationCodes).length > 0 ? nonEmpty(scope.locationCodes) : existing.locationCodes,
    workerIds: nonEmpty(scope.workerIds).length > 0 ? nonEmpty(scope.workerIds) : existing.workerIds,
    effectiveFrom: scope.effectiveFrom ?? existing.effectiveFrom,
    effectiveUntil: scope.effectiveUntil ?? existing.effectiveUntil,
  };
}

function withPayrollScope<T extends StatutoryPayrollPack | EarningPolicy | DeductionPolicy | PayrollBlockingRule>(policy: T, scope: PolicyScope): T {
  const scoped = withScope(policy as ScopedPolicy, scope) as T;
  if ('countryCode' in scoped && nonEmpty(scope.countryCodes).length === 1) {
    return { ...scoped, countryCode: scope.countryCodes?.[0] } as T;
  }
  if ('appliesToEmployeeTypes' in scoped && nonEmpty(scope.employeeTypes).length > 0) {
    return { ...scoped, appliesToEmployeeTypes: nonEmpty(scope.employeeTypes) } as T;
  }
  return scoped;
}

@Injectable()
export class PolicyCenterService {
  constructor(
    @Optional() @Inject(PolicyCenterRepository) private readonly repository: PolicyCenterRepositoryPort = new PolicyCenterRepository(),
    @Optional() private readonly hcmSetup: Pick<HcmSetupService, 'getSetup' | 'updateSetup'> = new HcmSetupService(),
    @Optional() private readonly notificationRepository: Pick<PlatformNotificationRepository, 'createMany'> = new PlatformNotificationRepository(),
    @Optional() @Inject(AuditLedgerService) private readonly auditLedger?: Pick<AuditLedgerService, 'write'>,
    @Optional() @Inject(OutboxPublisher) private readonly outbox?: Pick<OutboxPublisher, 'schedule'>,
  ) {}

  async getSummary(tenantId: Uuid) {
    return this.repository.summarizePolicyCenter(tenantId.value);
  }

  async listRevisions(tenantId: Uuid, area?: PolicyArea): Promise<PolicyRevisionRecord[]> {
    return this.repository.listRevisions(tenantId.value, area);
  }

  async listDecisionEvidence(tenantId: Uuid, limit = 25) {
    return this.repository.listDecisionEvidence(tenantId.value, limit);
  }

  async createRevision(tenantId: Uuid, input: CreatePolicyRevisionInput, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    const setup = await this.hcmSetup.getSetup(tenantId);
    const baselineConfig = extractBaselineConfig(input.area, setup);
    const timestamp = nowIso();
    const record: PolicyRevisionRecord = {
      id: Uuid.generate().value,
      tenantId: tenantId.value,
      area: input.area,
      title: input.title,
      status: 'DRAFT',
      baselineConfig,
      draftConfig: input.draftConfig ?? baselineConfig,
      scope: normalizedScope(tenantId, input.scope),
      createdBy: actor.actorId,
      createdAt: timestamp,
      updatedAt: timestamp,
      aggregateVersion: 0,
    };

    await this.recordLifecycleGovernance(tenantId, {
      revision: record,
      actor,
      eventName: 'PolicyRevisionDrafted',
      fromStatus: 'INITIAL',
      toStatus: 'DRAFT',
      payload: { changedFields: ['baselineConfig', 'draftConfig', 'scope'] },
    });
    return this.repository.createRevision(record);
  }

  async updateRevision(tenantId: Uuid, id: string, input: UpdatePolicyRevisionInput, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    const revision = await this.getRevisionOrThrow(tenantId, id);
    if (!['DRAFT', 'IN_REVIEW', 'REVIEWED'].includes(revision.status)) {
      throw new BadRequestException('Only draft, in-review, or reviewed policy revisions can be edited.');
    }

    const updatedFields = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    await this.recordLifecycleGovernance(tenantId, {
      revision,
      actor,
      eventName: 'PolicyRevisionUpdated',
      fromStatus: revision.status,
      toStatus: revision.status,
      payload: { changedFields: updatedFields },
    });

    return this.repository.updateRevision(id, {
      title: input.title ?? revision.title,
      draftConfig: input.draftConfig ?? revision.draftConfig,
      scope: input.scope ? normalizedScope(tenantId, { ...revision.scope, ...input.scope }) : revision.scope,
      reviewNotes: input.reviewNotes ?? revision.reviewNotes,
      updatedAt: nowIso(),
      aggregateVersion: revision.aggregateVersion + 1,
      createdBy: revision.createdBy ?? actor.actorId,
      validationResult: undefined,
      simulationResult: undefined,
    });
  }

  async validateRevision(tenantId: Uuid, id: string, actor: PolicyActor): Promise<PolicyValidationResult> {
    const revision = await this.getRevisionOrThrow(tenantId, id);
    const result = await this.validatePolicyRevision(tenantId, revision);
    await this.repository.updateRevision(id, {
      validationResult: result,
      updatedAt: nowIso(),
      aggregateVersion: revision.aggregateVersion + 1,
      createdBy: revision.createdBy ?? actor.actorId,
    });
    return result;
  }

  async simulateRevision(tenantId: Uuid, id: string, actor: PolicyActor): Promise<PolicyImpactSimulationResult> {
    const revision = await this.getRevisionOrThrow(tenantId, id);
    const result = await this.simulatePolicyRevision(tenantId, revision);
    await this.repository.updateRevision(id, {
      simulationResult: result,
      updatedAt: nowIso(),
      aggregateVersion: revision.aggregateVersion + 1,
    });
    await this.repository.createImpactResult({
      id: Uuid.generate().value,
      tenantId: tenantId.value,
      revisionId: revision.id,
      simulationResult: result,
      createdBy: actor.actorId,
      createdAt: nowIso(),
    });
    if (result.impactedEmployees > 0 || Object.values(result.pendingRecords).some((count) => count > 0)) {
      await this.notifyLifecycle(revision, tenantId, 'PolicyRevisionImpactDetected', actor, { simulation: result });
    }
    return result;
  }

  async submitForReview(tenantId: Uuid, id: string, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    return this.transition(tenantId, id, actor, ['DRAFT'], 'IN_REVIEW', {
      submittedAt: nowIso(),
    });
  }

  async markReviewed(tenantId: Uuid, id: string, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    return this.transition(tenantId, id, actor, ['IN_REVIEW'], 'REVIEWED', {
      reviewedAt: nowIso(),
      reviewedBy: actor.actorId,
    });
  }

  async approveRevision(tenantId: Uuid, id: string, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    return this.transition(tenantId, id, actor, ['REVIEWED'], 'APPROVED', {
      approvedAt: nowIso(),
      approvedBy: actor.actorId,
    });
  }

  async publishRevision(tenantId: Uuid, id: string, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    const revision = await this.getRevisionOrThrow(tenantId, id);
    if (revision.status !== 'APPROVED') {
      throw new BadRequestException('Only approved policy revisions can be published.');
    }
    const validation = await this.validatePolicyRevision(tenantId, revision);
    if (!validation.valid) {
      await this.repository.updateRevision(id, { validationResult: validation, updatedAt: nowIso() });
      throw new BadRequestException(`Policy cannot be published: ${validation.errors.join(' ')}`);
    }
    await this.recordLifecycleGovernance(tenantId, {
      revision,
      actor,
      eventName: 'PolicyRevisionPublished',
      fromStatus: revision.status,
      toStatus: 'PUBLISHED',
      payload: { validation },
    });
    const updated = await this.repository.updateRevision(id, {
      status: 'PUBLISHED',
      validationResult: validation,
      publishedAt: nowIso(),
      publishedBy: actor.actorId,
      updatedAt: nowIso(),
      aggregateVersion: revision.aggregateVersion + 1,
    });
    await this.notifyLifecycle(updated, tenantId, 'PolicyRevisionPublished', actor);
    return updated;
  }

  async applyRevision(tenantId: Uuid, id: string, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    const revision = await this.getRevisionOrThrow(tenantId, id);
    if (revision.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published policy revisions can be applied.');
    }

    const validation = await this.validatePolicyRevision(tenantId, revision);
    if (!validation.valid) {
      await this.repository.updateRevision(id, { validationResult: validation, updatedAt: nowIso() });
      throw new BadRequestException(`Policy cannot be applied: ${validation.errors.join(' ')}`);
    }

    const simulation = await this.simulatePolicyRevision(tenantId, revision);
    const runtimeSnapshot = this.buildRuntimeSnapshot(revision);
    await this.recordLifecycleGovernance(tenantId, {
      revision,
      actor,
      eventName: 'PolicyRevisionApplied',
      fromStatus: revision.status,
      toStatus: 'APPLIED',
      payload: {
        validation,
        simulation: {
          impactedEmployees: simulation.impactedEmployees,
          pendingRecords: simulation.pendingRecords,
          warnings: simulation.warnings,
          engineName: simulation.engineName,
          engineVersion: simulation.engineVersion,
        },
      },
    });
    await this.hcmSetup.updateSetup(tenantId, runtimeSnapshot);
    await this.repository.createApplicationRun({
      id: Uuid.generate().value,
      tenantId: tenantId.value,
      revisionId: revision.id,
      status: 'APPLIED',
      impactedEmployees: simulation.impactedEmployees,
      pendingRecords: simulation.pendingRecords,
      appliedBy: actor.actorId,
      appliedAt: nowIso(),
      runtimeSnapshot,
    });
    await this.repository.createDecisionEvidence({
      id: Uuid.generate().value,
      tenantId: tenantId.value,
      policyRevisionId: revision.id,
      serviceArea: revision.area,
      engineName: 'PolicyApplicationEngine',
      engineVersion: ENGINE_VERSION,
      scopeMatch: revision.scope,
      decision: 'APPLIED',
      reason: 'Approved and published policy revision was written to the HCM runtime setup snapshot.',
      createdAt: nowIso(),
    });

    const replacesRevisionId = replacementRevisionId(revision);
    if (replacesRevisionId) {
      const replaced = await this.repository.findRevisionById(tenantId.value, replacesRevisionId);
      if (replaced && replaced.area === revision.area && ['PUBLISHED', 'APPLIED'].includes(replaced.status)) {
        await this.repository.updateRevision(replaced.id, {
          status: 'ARCHIVED',
          updatedAt: nowIso(),
          aggregateVersion: replaced.aggregateVersion + 1,
        });
      }
    }

    const updated = await this.repository.updateRevision(id, {
      status: 'APPLIED',
      validationResult: validation,
      simulationResult: simulation,
      appliedBy: actor.actorId,
      appliedAt: nowIso(),
      updatedAt: nowIso(),
      aggregateVersion: revision.aggregateVersion + 1,
    });
    await this.notifyPolicyApplied(updated, tenantId, actor, simulation);
    return updated;
  }

  private async transition(
    tenantId: Uuid,
    id: string,
    actor: PolicyActor,
    allowed: PolicyRevisionStatus[],
    status: PolicyRevisionStatus,
    extra: Partial<PolicyRevisionRecord>,
  ): Promise<PolicyRevisionRecord> {
    const revision = await this.getRevisionOrThrow(tenantId, id);
    if (!allowed.includes(revision.status)) {
      throw new BadRequestException(`Policy revision ${revision.id} cannot move from ${revision.status} to ${status}.`);
    }
    await this.recordLifecycleGovernance(tenantId, {
      revision,
      actor,
      eventName: LIFECYCLE_EVENT_NAMES[status],
      fromStatus: revision.status,
      toStatus: status,
    });
    const updated = await this.repository.updateRevision(id, {
      status,
      ...extra,
      updatedAt: nowIso(),
      aggregateVersion: revision.aggregateVersion + 1,
    });
    await this.notifyLifecycle(updated, tenantId, LIFECYCLE_EVENT_NAMES[status], actor);
    return updated;
  }

  private async recordLifecycleGovernance(
    tenantId: Uuid,
    input: PolicyLifecycleEvidenceInput,
  ): Promise<void> {
    if (!this.auditLedger || !this.outbox) {
      throw new Error('Policy Center audit/outbox governance is not configured.');
    }

    const correlationId = Uuid.generate();
    const resourceId = this.uuidFromValue(input.revision.id);
    const actorId = this.uuidFromValue(input.actor.actorId);
    const basePayload = {
      policyRevisionId: input.revision.id,
      policyArea: input.revision.area,
      title: input.revision.title,
      actorId: input.actor.actorId,
      actorName: input.actor.actorName,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      aggregateVersion: input.revision.aggregateVersion,
      governanceStage: 'BLOCKING_PRE_MUTATION',
      ...input.payload,
    };

    await this.auditLedger.write({
      id: Uuid.generate(),
      tenantId,
      actorType: 'USER',
      actorId,
      action: input.eventName,
      resourceType: 'PolicyRevision',
      resourceId,
      payload: basePayload,
      occurredAt: new Date(),
      correlationId,
      dataClassification: 'CONFIDENTIAL',
      legalHoldStatus: 'NONE',
      retentionClass: input.toStatus === 'APPLIED' || input.toStatus === 'PUBLISHED' ? 'EXTENDED' : 'STANDARD',
    });

    const event: HrEventEnvelope<Record<string, unknown>> = {
      eventId: Uuid.generate(),
      eventName: input.eventName,
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: 'PolicyRevision',
      aggregateId: resourceId,
      payload: basePayload,
      metadata: {
        correlationId,
        requestHash: `${input.eventName}:${input.revision.id}:${input.revision.aggregateVersion}:${input.toStatus}`,
        clientType: 'HR_ADMIN',
        hrDataSensitivity: 'LOW',
      },
      privacy: createPrivacyForEvent('LOW', undefined, 'PROFILE'),
      occurredAt: new Date(),
      version: input.revision.aggregateVersion + 1,
    };

    await this.outbox.schedule(event, tenantId, correlationId);
  }

  private uuidFromValue(value: string): Uuid {
    if (Uuid.isValid(value)) {
      return new Uuid(value);
    }
    const hex = createHash('sha256').update(value).digest('hex');
    return new Uuid(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`);
  }

  private async getRevisionOrThrow(tenantId: Uuid, id: string): Promise<PolicyRevisionRecord> {
    const revision = await this.repository.findRevisionById(tenantId.value, id);
    if (!revision) throw new NotFoundException(`Policy revision ${id} was not found.`);
    return revision;
  }

  private async validatePolicyRevision(tenantId: Uuid, revision: PolicyRevisionRecord): Promise<PolicyValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const conflicts: PolicyValidationResult['conflicts'] = [];

    if (revision.scope.effectiveFrom && revision.scope.effectiveUntil) {
      const from = new Date(`${revision.scope.effectiveFrom}T00:00:00.000Z`).getTime();
      const until = new Date(`${revision.scope.effectiveUntil}T00:00:00.000Z`).getTime();
      if (from > until) errors.push('Policy effective start date must be before effective end date.');
    }

    const codeKeys = ['leavePolicies', 'statutoryPayrollPacks', 'earningPolicies', 'deductionPolicies', 'payrollBlockingRules'];
    for (const key of codeKeys) {
      const duplicates = duplicateValues(collectPolicyCodes(revision.draftConfig, key));
      if (duplicates.length > 0) {
        errors.push(`Duplicate policy codes in ${key}: ${duplicates.join(', ')}.`);
      }
    }

    const active = await this.repository.listActiveRevisionsByArea(tenantId.value, revision.area);
    const replacesRevisionId = replacementRevisionId(revision);
    for (const candidate of active) {
      if (candidate.id === revision.id) continue;
      if (candidate.id === replacesRevisionId) continue;
      if (!effectiveWindowOverlaps(revision.scope, candidate.scope)) continue;
      if (!scopesTargetSameAudience(revision.scope, candidate.scope)) continue;
      const reason = `Active ${revision.area} policy ${candidate.id} already targets the same scope and effective window.`;
      errors.push(reason);
      conflicts.push({ revisionId: candidate.id, reason });
    }

    if (revision.area === 'ATTENDANCE') {
      const attendance = asObject(revision.draftConfig).attendancePolicy;
      const geofenceEnabled = asObject(attendance).geofenceEnabled;
      const radius = asObject(attendance).allowedRadiusMeters;
      if (geofenceEnabled === true && (typeof radius !== 'number' || radius <= 0)) {
        warnings.push('Geofence is enabled but no positive allowed radius is configured.');
      }
    }

    if (revision.area === 'ACCESS_GOVERNANCE' && !asObject(revision.draftConfig).policyGovernance) {
      warnings.push('Access governance policy has no allowed-action or field-access override payload.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      conflicts,
      engineName: 'PolicyValidationEngine',
      engineVersion: ENGINE_VERSION,
    };
  }

  private async simulatePolicyRevision(tenantId: Uuid, revision: PolicyRevisionRecord): Promise<PolicyImpactSimulationResult> {
    const impacted = await this.repository.countImpactedWorkers(tenantId.value, revision.scope);
    const pendingRecords = await this.repository.countPendingDomainRecords(tenantId.value, revision.area, revision.scope);
    const warnings: string[] = [];
    if (revision.scope.effectiveFrom && new Date(`${revision.scope.effectiveFrom}T00:00:00.000Z`).getTime() < Date.now()) {
      warnings.push('Policy is retroactive; final historical records will not be rewritten automatically.');
    }
    if (Object.values(pendingRecords).some((count) => count > 0)) {
      warnings.push('Pending or open records may need revalidation after apply.');
    }

    return {
      impactedEmployees: impacted.count,
      impactedWorkerIds: impacted.workerIds,
      pendingRecords,
      oldDataRule: 'Approved, locked, and finalized historical records are not silently rewritten.',
      newDataRule: 'New transactions use the applied policy active on the transaction date.',
      retroactiveRule: 'Retroactive policy effects create adjustment records or exception queues through explicit admin action.',
      warnings,
      engineName: 'PolicyImpactSimulationEngine',
      engineVersion: ENGINE_VERSION,
    };
  }

  private buildRuntimeSnapshot(revision: PolicyRevisionRecord): HcmSetupUpdate {
    const draft = revision.draftConfig as HcmSetupUpdate;
    const scope = revision.scope;

    if (revision.area === 'LEAVE') {
      return {
        leavePolicies: (draft.leavePolicies ?? []).map((policy) => withScope(policy, scope)),
      };
    }

    if (revision.area === 'ATTENDANCE') {
      const attendancePolicy = asObject(draft.attendancePolicy) as Partial<AttendancePolicy>;
      return {
        attendancePolicy: {
          ...attendancePolicy,
          shiftRotations: attendancePolicy.shiftRotations?.map((policy: AttendanceShiftRotationRule) => withScope(policy, scope)),
          geofenceProfiles: attendancePolicy.geofenceProfiles?.map((policy: AttendanceGeofenceProfile) => withScope(policy, scope)),
          deviceTrustRules: attendancePolicy.deviceTrustRules?.map((policy: AttendanceDeviceTrustRule) => withScope(policy, scope)),
          flexibleHoursRules: attendancePolicy.flexibleHoursRules?.map((policy: AttendanceFlexibleHoursRule) => withScope(policy, scope)),
        },
      } as HcmSetupUpdate;
    }

    if (revision.area === 'PAYROLL') {
      return {
        payrollCalculationPolicy: draft.payrollCalculationPolicy,
        statutoryPayrollPacks: draft.statutoryPayrollPacks?.map((policy) => withPayrollScope(policy, scope)),
        earningPolicies: draft.earningPolicies?.map((policy) => withPayrollScope(policy, scope)),
        deductionPolicies: draft.deductionPolicies?.map((policy) => withPayrollScope(policy, scope)),
        payrollBlockingRules: draft.payrollBlockingRules?.map((policy) => withPayrollScope(policy, scope)),
      };
    }

    if (revision.area === 'ACCESS_GOVERNANCE') {
      return { policyGovernance: draft.policyGovernance };
    }

    if (revision.area === 'COUNTRY_POLICY') {
      const draftObject = asObject(revision.draftConfig);
      return { countryPolicyRuntime: asObject(draftObject.countryPolicyRuntime ?? draftObject) };
    }

    if (revision.area === 'COMPLIANCE') {
      const draftObject = asObject(revision.draftConfig);
      return { compliancePolicyRuntime: asObject(draftObject.compliancePolicyRuntime ?? draftObject) };
    }

    return draft;
  }

  private async notifyLifecycle(
    revision: PolicyRevisionRecord,
    tenantId: Uuid,
    eventName: string,
    actor: PolicyActor,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.notificationRepository.createMany([
      {
        tenantId: tenantId.value,
        audience: 'HR_OPERATIONS',
        recipientRole: 'HR_ADMIN',
        category: 'POLICY',
        title: revision.title,
        body: `${revision.area} policy ${revision.status.toLowerCase().replace(/_/g, ' ')} by ${actor.actorName ?? actor.actorId}.`,
        sourceEventId: Uuid.generate().value,
        sourceEventName: eventName,
        relatedAggregateType: 'PolicyRevision',
        relatedAggregateId: revision.id,
        payload: {
          policyRevisionId: revision.id,
          policyArea: revision.area,
          status: revision.status,
          ...payload,
        },
      },
    ]);
  }

  private async notifyPolicyApplied(
    revision: PolicyRevisionRecord,
    tenantId: Uuid,
    actor: PolicyActor,
    simulation: PolicyImpactSimulationResult,
  ): Promise<void> {
    const sourceEventId = Uuid.generate().value;
    const title = AREA_NOTIFICATION_TITLES[revision.area];
    const employeeNotifications = simulation.impactedWorkerIds.slice(0, 250).map((workerId) => ({
      tenantId: tenantId.value,
      audience: 'EMPLOYEE' as const,
      recipientWorkerId: workerId,
      category: 'POLICY',
      title,
      body: `${revision.title} is now applied. New service requests use this policy from ${revision.scope.effectiveFrom ?? 'today'}.`,
      sourceEventId,
      sourceEventName: 'PolicyRevisionApplied',
      relatedAggregateType: 'PolicyRevision',
      relatedAggregateId: revision.id,
      payload: {
        policyRevisionId: revision.id,
        policyArea: revision.area,
        scope: revision.scope,
        simulation,
      },
    }));

    await this.notificationRepository.createMany([
      {
        tenantId: tenantId.value,
        audience: 'HR_OPERATIONS',
        recipientRole: 'HR_ADMIN',
        category: 'POLICY',
        title: `${revision.area} policy applied`,
        body: `${revision.title} was applied by ${actor.actorName ?? actor.actorId}; ${simulation.impactedEmployees} employees are in scope.`,
        sourceEventId,
        sourceEventName: 'PolicyRevisionApplied',
        relatedAggregateType: 'PolicyRevision',
        relatedAggregateId: revision.id,
        payload: {
          policyRevisionId: revision.id,
          policyArea: revision.area,
          scope: revision.scope,
          simulation,
        },
      },
      ...employeeNotifications,
    ]);
  }
}
