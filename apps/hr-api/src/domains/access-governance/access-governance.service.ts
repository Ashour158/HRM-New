import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AuditLedgerService } from '@hcm/platform-core';
import { Uuid } from '@hcm/shared-kernel';
import { createPrivacyForEvent, type HrEventEnvelope } from '@hcm/event-schemas';
import { OutboxPublisher } from '../../platform/outbox-inbox/outbox-publisher.js';
import { UsersRepository } from '../../auth/users.repository.js';
import { AccessGovernanceRepository } from './access-governance.repository.js';
import type {
  AbacPolicyView,
  AccessGovernanceSummary,
  AccessReviewCampaignView,
  AccessReviewItemView,
  AccessReviewWorkflowCommandDto,
  AccessReviewWorkflowEventView,
  AssignUserRoleDto,
  CreateAbacPolicyDto,
  CreateAccessReviewCampaignDto,
  CreateAccessReviewItemDto,
  CreateFieldAccessPolicyDto,
  CreatePermissionDto,
  CreateRoleDto,
  CreateServiceAccountDto,
  CreateSodRuleDto,
  FieldAccessPolicyView,
  IssuedServiceAccountCredentialView,
  IssueServiceAccountCredentialDto,
  PermissionView,
  RemediateSodViolationDto,
  RevokeServiceAccountCredentialDto,
  RotateServiceAccountCredentialDto,
  RolePermissionView,
  RoleView,
  ServiceAccountCredentialLifecycleView,
  ServiceAccountCredentialView,
  ServiceAccountView,
  SodRemediationAction,
  SodRemediationView,
  SodRuleView,
  UpdateAbacPolicyDto,
  UpdateAccessReviewCampaignDto,
  UpdateAccessReviewItemDto,
  UpdateFieldAccessPolicyDto,
  UpdatePermissionDto,
  UpdateRoleDto,
  UpdateServiceAccountDto,
  UpdateSodRuleDto,
  UserRoleView,
} from './access-governance.types.js';
import type {
  AbacPolicyRecord,
  AccessReviewCampaignRecord,
  AccessReviewItemRecord,
  AccessReviewWorkflowEventRecord,
  FieldAccessPolicyRecord,
  PermissionRecord,
  RolePermissionRecord,
  RoleRecord,
  ServiceAccountCredentialRecord,
  ServiceAccountRecord,
  SodRuleRecord,
  UserRoleRecord,
} from './access-governance.repository.js';

const EFFECTS = new Set(['ALLOW', 'DENY']);
const SERVICE_ACCOUNT_STATUSES = new Set(['ACTIVE', 'DISABLED', 'ROTATION_DUE', 'EXPIRED']);
const SERVICE_ACCOUNT_CREDENTIAL_STATUSES = new Set(['ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED']);
const ACCESS_REVIEW_STATUSES = new Set(['DRAFT', 'LAUNCHED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']);
const ACCESS_REVIEW_DECISIONS = new Set(['PENDING', 'APPROVED', 'REVOKE', 'ESCALATE']);
const ACCESS_REVIEW_WORKFLOW_EVENTS = new Set(['LAUNCHED', 'REMINDER_SENT', 'ESCALATED', 'COMPLETED', 'REVOKE_FULFILLED']);
const SOD_REMEDIATION_ACTIONS = new Set(['REMOVE_VIOLATING_ROLE', 'REMOVE_CONFLICTING_ROLE', 'DOCUMENT_EXCEPTION']);

@Injectable()
export class AccessGovernanceService {
  constructor(
    private readonly repository: AccessGovernanceRepository,
    @Optional() @Inject(AuditLedgerService) private readonly auditLedger?: Pick<AuditLedgerService, 'write'>,
    @Optional() @Inject(OutboxPublisher) private readonly outbox?: Pick<OutboxPublisher, 'schedule'>,
    @Optional() @Inject(UsersRepository) private readonly usersRepository?: Pick<UsersRepository, 'setRolesAndPermissions'>,
  ) {}

  async getSummary(tenantId: Uuid): Promise<AccessGovernanceSummary> {
    const [
      roles,
      permissions,
      rolePermissions,
      userRoles,
      serviceAccounts,
      serviceAccountCredentials,
      accessReviewCampaigns,
      accessReviewItems,
      accessReviewWorkflowEvents,
      abacPolicies,
      fieldAccessPolicies,
      sodRules,
    ] = await Promise.all([
      this.repository.listRoles(tenantId),
      this.repository.listPermissions(tenantId),
      this.repository.listRolePermissions(tenantId),
      this.repository.listUserRoles(tenantId),
      this.repository.listServiceAccounts(tenantId),
      this.repository.listServiceAccountCredentials(tenantId),
      this.repository.listAccessReviewCampaigns(tenantId),
      this.repository.listAccessReviewItems(tenantId),
      this.repository.listAccessReviewWorkflowEvents(tenantId),
      this.repository.listAbacPolicies(tenantId),
      this.repository.listFieldAccessPolicies(tenantId),
      this.repository.listSodRules(tenantId),
    ]);

    return {
      roles: roles.map((role) => this.toRoleView(role)),
      permissions: permissions.map((permission) => this.toPermissionView(permission)),
      rolePermissions: rolePermissions.map((assignment) => this.toRolePermissionView(assignment)),
      userRoles: userRoles.map((assignment) => this.toUserRoleView(assignment)),
      serviceAccounts: serviceAccounts.map((account) => this.toServiceAccountView(account)),
      serviceAccountCredentials: serviceAccountCredentials.map((credential) => this.toServiceAccountCredentialView(credential)),
      accessReviewCampaigns: accessReviewCampaigns.map((campaign) => this.toAccessReviewCampaignView(campaign)),
      accessReviewItems: accessReviewItems.map((item) => this.toAccessReviewItemView(item)),
      accessReviewWorkflowEvents: accessReviewWorkflowEvents.map((event) => this.toAccessReviewWorkflowEventView(event)),
      abacPolicies: abacPolicies.map((policy) => this.toAbacPolicyView(policy)),
      fieldAccessPolicies: fieldAccessPolicies.map((policy) => this.toFieldAccessPolicyView(policy)),
      sodRules: sodRules.map((rule) => this.toSodRuleView(rule)),
    };
  }

  async createRole(tenantId: Uuid, dto: CreateRoleDto): Promise<RoleView> {
    const role = await this.repository.createRole(tenantId, {
      code: this.requiredCode(dto.code, 'code'),
      name: this.requiredString(dto.name, 'name'),
      tier: this.requiredString(dto.tier, 'tier'),
      description: this.optionalString(dto.description),
      is_system: dto.isSystem ?? false,
    });
    return this.toRoleView(role);
  }

  async updateRole(tenantId: Uuid, roleId: Uuid, dto: UpdateRoleDto): Promise<RoleView> {
    const role = await this.repository.updateRole(tenantId, roleId, {
      ...(dto.code !== undefined ? { code: this.requiredCode(dto.code, 'code') } : {}),
      ...(dto.name !== undefined ? { name: this.requiredString(dto.name, 'name') } : {}),
      ...(dto.tier !== undefined ? { tier: this.requiredString(dto.tier, 'tier') } : {}),
      ...(dto.description !== undefined ? { description: this.optionalString(dto.description) } : {}),
      ...(dto.isSystem !== undefined ? { is_system: Boolean(dto.isSystem) } : {}),
    });
    if (!role) throw new NotFoundException('Role not found');
    return this.toRoleView(role);
  }

  async createPermission(tenantId: Uuid, dto: CreatePermissionDto): Promise<PermissionView> {
    const permission = await this.repository.createPermission(tenantId, {
      code: this.requiredCode(dto.code, 'code'),
      description: this.optionalString(dto.description),
      domain: this.requiredCode(dto.domain, 'domain'),
      data_classification: this.optionalString(dto.dataClassification),
      audit_on_access: dto.auditOnAccess ?? false,
    });
    return this.toPermissionView(permission);
  }

  async updatePermission(tenantId: Uuid, permissionId: Uuid, dto: UpdatePermissionDto): Promise<PermissionView> {
    const permission = await this.repository.updatePermission(tenantId, permissionId, {
      ...(dto.code !== undefined ? { code: this.requiredCode(dto.code, 'code') } : {}),
      ...(dto.description !== undefined ? { description: this.optionalString(dto.description) } : {}),
      ...(dto.domain !== undefined ? { domain: this.requiredCode(dto.domain, 'domain') } : {}),
      ...(dto.dataClassification !== undefined ? { data_classification: this.optionalString(dto.dataClassification) } : {}),
      ...(dto.auditOnAccess !== undefined ? { audit_on_access: Boolean(dto.auditOnAccess) } : {}),
    });
    if (!permission) throw new NotFoundException('Permission not found');
    return this.toPermissionView(permission);
  }

  async replaceRolePermissions(tenantId: Uuid, roleId: Uuid, permissionIds: string[]): Promise<RolePermissionView[]> {
    const permissionUuids = permissionIds.map((permissionId) => this.uuid(permissionId, 'permissionIds'));
    const assignments = await this.repository.replaceRolePermissions(tenantId, roleId, permissionUuids);
    await this.syncUsersHoldingRole(tenantId, roleId);
    return assignments.map((assignment) => this.toRolePermissionView(assignment));
  }

  async assignRolePermission(tenantId: Uuid, roleId: Uuid, permissionId: Uuid): Promise<RolePermissionView[]> {
    await this.repository.assignRolePermission(tenantId, roleId, permissionId);
    const assignments = await this.repository.listRolePermissions(tenantId);
    await this.syncUsersHoldingRole(tenantId, roleId);
    return assignments.map((assignment) => this.toRolePermissionView(assignment));
  }

  async removeRolePermission(tenantId: Uuid, roleId: Uuid, permissionId: Uuid): Promise<RolePermissionView[]> {
    await this.repository.removeRolePermission(tenantId, roleId, permissionId);
    const assignments = await this.repository.listRolePermissions(tenantId);
    await this.syncUsersHoldingRole(tenantId, roleId);
    return assignments.map((assignment) => this.toRolePermissionView(assignment));
  }

  async assignUserRole(tenantId: Uuid, dto: AssignUserRoleDto, assignedBy?: Uuid): Promise<UserRoleView[]> {
    const userId = this.uuid(this.requiredString(dto.userId, 'userId'), 'userId');
    const assignments = await this.repository.assignUserRole(
      tenantId,
      userId,
      this.uuid(this.requiredString(dto.roleId, 'roleId'), 'roleId'),
      assignedBy,
      this.optionalDate(dto.expiresAt),
    );
    await this.syncUserAccess(tenantId, userId);
    return assignments.map((assignment) => this.toUserRoleView(assignment));
  }

  async removeUserRole(tenantId: Uuid, userId: Uuid, roleId: Uuid): Promise<UserRoleView[]> {
    const assignments = await this.repository.removeUserRole(tenantId, userId, roleId);
    await this.syncUserAccess(tenantId, userId);
    return assignments.map((assignment) => this.toUserRoleView(assignment));
  }

  /**
   * Recomputes and persists one user's effective roles/permissions from their
   * current role assignments, so the next JWT issuance/refresh reflects the
   * change instead of the stale snapshot taken at invite/JIT-provisioning
   * time (HCM-P0-2: Access Governance changes previously had zero runtime
   * effect because nothing ever re-derived users.roles/permissions).
   */
  private async syncUserAccess(tenantId: Uuid, userId: Uuid): Promise<void> {
    if (!this.usersRepository) return;
    const { roles, permissions } = await this.repository.computeEffectiveUserAccess(tenantId, userId);
    await this.usersRepository.setRolesAndPermissions(userId.value, roles, permissions);
  }

  /** Fans out a resync to every user holding a role whose permission set just changed. */
  private async syncUsersHoldingRole(tenantId: Uuid, roleId: Uuid): Promise<void> {
    if (!this.usersRepository) return;
    const userIds = await this.repository.listUserIdsForRole(tenantId, roleId);
    await Promise.all(userIds.map((userId) => this.syncUserAccess(tenantId, new Uuid(userId))));
  }

  async createServiceAccount(tenantId: Uuid, dto: CreateServiceAccountDto, createdBy?: Uuid): Promise<ServiceAccountView> {
    const account = await this.repository.createServiceAccount(tenantId, {
      code: this.requiredCode(dto.code, 'code'),
      name: this.requiredString(dto.name, 'name'),
      owner_worker_id: this.optionalUuidValue(dto.ownerWorkerId, 'ownerWorkerId'),
      status: this.enumValue(dto.status ?? 'ACTIVE', SERVICE_ACCOUNT_STATUSES, 'status'),
      scopes: this.jsonbValue(dto.scopes ?? []),
      credential_rotation_days: this.optionalInteger(dto.credentialRotationDays, 'credentialRotationDays', 90),
      last_rotated_at: this.optionalDate(dto.lastRotatedAt),
      expires_at: this.optionalDate(dto.expiresAt),
      created_by: createdBy?.value ?? null,
    });
    return this.toServiceAccountView(account);
  }

  async updateServiceAccount(tenantId: Uuid, accountId: Uuid, dto: UpdateServiceAccountDto): Promise<ServiceAccountView> {
    const account = await this.repository.updateServiceAccount(tenantId, accountId, {
      ...(dto.code !== undefined ? { code: this.requiredCode(dto.code, 'code') } : {}),
      ...(dto.name !== undefined ? { name: this.requiredString(dto.name, 'name') } : {}),
      ...(dto.ownerWorkerId !== undefined ? { owner_worker_id: this.optionalUuidValue(dto.ownerWorkerId, 'ownerWorkerId') } : {}),
      ...(dto.status !== undefined ? { status: this.enumValue(dto.status, SERVICE_ACCOUNT_STATUSES, 'status') } : {}),
      ...(dto.scopes !== undefined ? { scopes: this.jsonbValue(dto.scopes) } : {}),
      ...(dto.credentialRotationDays !== undefined ? { credential_rotation_days: this.optionalInteger(dto.credentialRotationDays, 'credentialRotationDays', 90) } : {}),
      ...(dto.lastRotatedAt !== undefined ? { last_rotated_at: this.optionalDate(dto.lastRotatedAt) } : {}),
      ...(dto.expiresAt !== undefined ? { expires_at: this.optionalDate(dto.expiresAt) } : {}),
    });
    if (!account) throw new NotFoundException('Service account not found');
    return this.toServiceAccountView(account);
  }

  async issueServiceAccountCredential(
    tenantId: Uuid,
    accountId: Uuid,
    dto: IssueServiceAccountCredentialDto = {},
    actorId?: Uuid,
  ): Promise<IssuedServiceAccountCredentialView> {
    const account = await this.repository.findServiceAccount(tenantId, accountId);
    if (!account) throw new NotFoundException('Service account not found');
    if (account.status !== 'ACTIVE' && account.status !== 'ROTATION_DUE') {
      throw new BadRequestException('Credentials can only be issued for active or rotation-due service accounts');
    }

    const generated = this.generateOneTimeSecret();
    const credential = await this.repository.createServiceAccountCredential(tenantId, {
      service_account_id: accountId.value,
      name: this.optionalString(dto.name) ?? `${account.code} credential`,
      secret_hash: generated.secretHash,
      secret_prefix: generated.secretPrefix,
      status: this.enumValue('ACTIVE', SERVICE_ACCOUNT_CREDENTIAL_STATUSES, 'status'),
      scopes: this.jsonbValue(dto.scopes ?? account.scopes ?? []),
      expires_at: this.optionalDate(dto.expiresAt),
      last_used_at: null,
      rotated_at: null,
      revoked_at: null,
      revoked_reason: null,
      created_by: actorId?.value ?? null,
    });

    await this.repository.updateServiceAccount(tenantId, accountId, {
      last_rotated_at: new Date(),
      status: 'ACTIVE',
    });
    await this.recordGovernanceEvent(tenantId, {
      eventName: 'ServiceAccountCredentialIssued',
      aggregateType: 'ServiceAccount',
      aggregateId: accountId,
      actorId,
      payload: {
        serviceAccountId: accountId.value,
        serviceAccountCode: account.code,
        credentialId: credential.id,
        credentialPrefix: credential.secret_prefix,
        scopes: credential.scopes,
        expiresAt: this.date(credential.expires_at),
      },
    });

    const view = this.toServiceAccountCredentialView(credential);
    return {
      ...view,
      credentialLifecycle: {
        ...view.credentialLifecycle,
        secretMaterialState: 'ONE_TIME_SECRET_RETURNED',
      },
      oneTimeSecret: generated.oneTimeSecret,
    };
  }

  async rotateServiceAccountCredential(
    tenantId: Uuid,
    accountId: Uuid,
    credentialId: Uuid,
    dto: RotateServiceAccountCredentialDto = {},
    actorId?: Uuid,
  ): Promise<IssuedServiceAccountCredentialView> {
    const existing = await this.repository.findServiceAccountCredential(tenantId, accountId, credentialId);
    if (!existing) throw new NotFoundException('Service account credential not found');
    if (existing.status === 'REVOKED') {
      throw new BadRequestException('Revoked credentials cannot be rotated');
    }

    await this.repository.updateServiceAccountCredential(tenantId, accountId, credentialId, {
      status: 'ROTATED',
      rotated_at: new Date(),
    });
    const issued = await this.issueServiceAccountCredential(tenantId, accountId, {
      name: dto.name ?? existing.name,
      scopes: dto.scopes ?? existing.scopes,
      expiresAt: dto.expiresAt ?? this.date(existing.expires_at),
    }, actorId);
    await this.recordGovernanceEvent(tenantId, {
      eventName: 'ServiceAccountCredentialRotated',
      aggregateType: 'ServiceAccount',
      aggregateId: accountId,
      actorId,
      payload: {
        serviceAccountId: accountId.value,
        rotatedCredentialId: credentialId.value,
        newCredentialId: issued.id,
      },
    });
    return issued;
  }

  async revokeServiceAccountCredential(
    tenantId: Uuid,
    accountId: Uuid,
    credentialId: Uuid,
    dto: RevokeServiceAccountCredentialDto = {},
    actorId?: Uuid,
  ): Promise<ServiceAccountCredentialView> {
    const credential = await this.repository.updateServiceAccountCredential(tenantId, accountId, credentialId, {
      status: 'REVOKED',
      revoked_at: new Date(),
      revoked_reason: this.optionalString(dto.reason),
    });
    if (!credential) throw new NotFoundException('Service account credential not found');
    await this.recordGovernanceEvent(tenantId, {
      eventName: 'ServiceAccountCredentialRevoked',
      aggregateType: 'ServiceAccount',
      aggregateId: accountId,
      actorId,
      payload: {
        serviceAccountId: accountId.value,
        credentialId: credential.id,
        reason: credential.revoked_reason,
      },
    });
    return this.toServiceAccountCredentialView(credential);
  }

  async createAccessReviewCampaign(
    tenantId: Uuid,
    dto: CreateAccessReviewCampaignDto,
    createdBy?: Uuid,
  ): Promise<AccessReviewCampaignView> {
    const campaign = await this.repository.createAccessReviewCampaign(tenantId, {
      code: this.requiredCode(dto.code, 'code'),
      name: this.requiredString(dto.name, 'name'),
      scope: dto.scope ?? {},
      reviewer_role: this.requiredCode(dto.reviewerRole ?? 'HR_ADMIN', 'reviewerRole'),
      status: this.enumValue(dto.status ?? 'DRAFT', ACCESS_REVIEW_STATUSES, 'status'),
      due_at: this.optionalDate(dto.dueAt),
      created_by: createdBy?.value ?? null,
      launched_at: null,
      last_reminder_at: null,
      escalated_at: null,
      escalation_count: 0,
      completed_at: null,
    });
    return this.toAccessReviewCampaignView(campaign);
  }

  async updateAccessReviewCampaign(
    tenantId: Uuid,
    campaignId: Uuid,
    dto: UpdateAccessReviewCampaignDto,
  ): Promise<AccessReviewCampaignView> {
    const status = dto.status !== undefined ? this.enumValue(dto.status, ACCESS_REVIEW_STATUSES, 'status') : undefined;
    const now = new Date();
    const campaign = await this.repository.updateAccessReviewCampaign(tenantId, campaignId, {
      ...(dto.code !== undefined ? { code: this.requiredCode(dto.code, 'code') } : {}),
      ...(dto.name !== undefined ? { name: this.requiredString(dto.name, 'name') } : {}),
      ...(dto.scope !== undefined ? { scope: dto.scope } : {}),
      ...(dto.reviewerRole !== undefined ? { reviewer_role: this.requiredCode(dto.reviewerRole, 'reviewerRole') } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(dto.dueAt !== undefined ? { due_at: this.optionalDate(dto.dueAt) } : {}),
      ...(status === 'LAUNCHED' || status === 'IN_REVIEW' ? { launched_at: this.optionalDate(dto.launchedAt) ?? now } : {}),
      ...(status === 'COMPLETED' ? { completed_at: this.optionalDate(dto.completedAt) ?? now } : {}),
    });
    if (!campaign) throw new NotFoundException('Access review campaign not found');
    return this.toAccessReviewCampaignView(campaign);
  }

  async createAccessReviewItem(tenantId: Uuid, dto: CreateAccessReviewItemDto): Promise<AccessReviewItemView[]> {
    const assignedReviewerId = this.optionalUuidValue(dto.reviewerId, 'reviewerId');
    const items = await this.repository.createAccessReviewItem(tenantId, {
      campaign_id: this.uuid(this.requiredString(dto.campaignId, 'campaignId'), 'campaignId').value,
      subject_user_id: this.optionalUuidValue(dto.subjectUserId, 'subjectUserId'),
      subject_worker_id: this.optionalUuidValue(dto.subjectWorkerId, 'subjectWorkerId'),
      role_id: this.optionalUuidValue(dto.roleId, 'roleId'),
      permission_id: this.optionalUuidValue(dto.permissionId, 'permissionId'),
      service_account_id: this.optionalUuidValue(dto.serviceAccountId, 'serviceAccountId'),
      decision: this.enumValue(dto.decision ?? 'PENDING', ACCESS_REVIEW_DECISIONS, 'decision'),
      reviewer_id: assignedReviewerId,
      reviewed_at: null,
      evidence: this.withReviewerAssignmentEvidence(dto.evidence, assignedReviewerId),
    });
    return items.map((item) => this.toAccessReviewItemView(item));
  }

  async updateAccessReviewItem(
    tenantId: Uuid,
    itemId: Uuid,
    dto: UpdateAccessReviewItemDto,
    reviewerId?: Uuid,
  ): Promise<AccessReviewItemView> {
    const decision = dto.decision !== undefined ? this.enumValue(dto.decision, ACCESS_REVIEW_DECISIONS, 'decision') : undefined;
    const assignedReviewerId = dto.reviewerId !== undefined ? this.optionalUuidValue(dto.reviewerId, 'reviewerId') : undefined;
    const decisionReviewerId = reviewerId?.value ?? assignedReviewerId;
    const decidedAt = new Date();
    const item = await this.repository.updateAccessReviewItem(tenantId, itemId, {
      ...(decision !== undefined ? {
        decision,
        ...(decisionReviewerId !== undefined ? { reviewer_id: decisionReviewerId } : {}),
        reviewed_at: decision === 'PENDING' ? null : decidedAt,
      } : {}),
      ...(decision === undefined && assignedReviewerId !== undefined ? { reviewer_id: assignedReviewerId } : {}),
      ...(decision !== undefined
        ? { evidence: this.withDecisionEvidence(dto.evidence, decision, decisionReviewerId ?? null, decidedAt) }
        : dto.evidence !== undefined
          ? { evidence: dto.evidence }
          : {}),
    });
    if (!item) throw new NotFoundException('Access review item not found');
    if (decision === 'REVOKE') {
      await this.fulfillAccessReviewRevocation(tenantId, item, reviewerId);
    }
    return this.toAccessReviewItemView(item);
  }

  async launchAccessReviewCampaign(tenantId: Uuid, campaignId: Uuid, actorId?: Uuid): Promise<AccessReviewWorkflowEventView> {
    const campaign = await this.getAccessReviewCampaignOrThrow(tenantId, campaignId);
    const pendingItems = await this.pendingAccessReviewItems(tenantId, campaignId);
    await this.repository.updateAccessReviewCampaign(tenantId, campaignId, {
      status: 'IN_REVIEW',
      launched_at: new Date(),
    });
    return this.createAccessReviewWorkflowEvent(tenantId, campaignId, {
      eventType: 'LAUNCHED',
      actorId,
      targetRole: campaign.reviewer_role,
      message: 'Access review campaign launched',
      pendingItemCount: pendingItems.length,
      payload: this.accessReviewPendingPayload(campaign, pendingItems),
    });
  }

  async sendAccessReviewReminders(
    tenantId: Uuid,
    campaignId: Uuid,
    dto: AccessReviewWorkflowCommandDto = {},
    actorId?: Uuid,
  ): Promise<AccessReviewWorkflowEventView> {
    const campaign = await this.getAccessReviewCampaignOrThrow(tenantId, campaignId);
    if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
      throw new BadRequestException('Completed or cancelled access reviews cannot receive reminders');
    }
    const pendingItems = await this.pendingAccessReviewItems(tenantId, campaignId);
    await this.repository.updateAccessReviewCampaign(tenantId, campaignId, {
      status: 'IN_REVIEW',
      last_reminder_at: new Date(),
    });
    return this.createAccessReviewWorkflowEvent(tenantId, campaignId, {
      eventType: 'REMINDER_SENT',
      actorId,
      targetRole: campaign.reviewer_role,
      message: this.optionalString(dto.message) ?? 'Access certification reminder sent',
      pendingItemCount: pendingItems.length,
      payload: this.accessReviewPendingPayload(campaign, pendingItems),
    });
  }

  async escalateAccessReviewCampaign(
    tenantId: Uuid,
    campaignId: Uuid,
    dto: AccessReviewWorkflowCommandDto = {},
    actorId?: Uuid,
  ): Promise<AccessReviewWorkflowEventView> {
    const campaign = await this.getAccessReviewCampaignOrThrow(tenantId, campaignId);
    if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
      throw new BadRequestException('Completed or cancelled access reviews cannot be escalated');
    }
    const pendingItems = await this.pendingAccessReviewItems(tenantId, campaignId);
    const escalationCount = (campaign.escalation_count ?? 0) + 1;
    await this.repository.updateAccessReviewCampaign(tenantId, campaignId, {
      status: 'IN_REVIEW',
      escalated_at: new Date(),
      escalation_count: escalationCount,
    });
    return this.createAccessReviewWorkflowEvent(tenantId, campaignId, {
      eventType: 'ESCALATED',
      actorId,
      targetRole: campaign.reviewer_role,
      message: this.optionalString(dto.message) ?? 'Access certification escalated',
      pendingItemCount: pendingItems.length,
      payload: this.accessReviewPendingPayload(campaign, pendingItems, { escalationCount }),
    });
  }

  async completeAccessReviewCampaign(
    tenantId: Uuid,
    campaignId: Uuid,
    actorId?: Uuid,
  ): Promise<AccessReviewWorkflowEventView> {
    const campaign = await this.getAccessReviewCampaignOrThrow(tenantId, campaignId);
    if (campaign.status === 'CANCELLED') {
      throw new BadRequestException('Cancelled access reviews cannot be completed');
    }
    const pendingCount = await this.pendingAccessReviewItemCount(tenantId, campaignId);
    if (pendingCount > 0) {
      throw new BadRequestException('Access review cannot be completed while certification items are pending');
    }
    await this.repository.updateAccessReviewCampaign(tenantId, campaignId, {
      status: 'COMPLETED',
      completed_at: new Date(),
    });
    return this.createAccessReviewWorkflowEvent(tenantId, campaignId, {
      eventType: 'COMPLETED',
      actorId,
      targetRole: campaign.reviewer_role,
      message: 'Access review campaign completed',
      pendingItemCount: 0,
      payload: { campaignCode: campaign.code },
    });
  }

  async createAbacPolicy(tenantId: Uuid, dto: CreateAbacPolicyDto): Promise<AbacPolicyView> {
    const policy = await this.repository.createAbacPolicy(tenantId, {
      dimension: this.requiredString(dto.dimension, 'dimension'),
      conditions: this.requiredJson(dto.conditions, 'conditions'),
      effect: this.effect(dto.effect),
      priority: this.optionalInteger(dto.priority, 'priority', 0),
    });
    return this.toAbacPolicyView(policy);
  }

  async updateAbacPolicy(tenantId: Uuid, policyId: Uuid, dto: UpdateAbacPolicyDto): Promise<AbacPolicyView> {
    const policy = await this.repository.updateAbacPolicy(tenantId, policyId, {
      ...(dto.dimension !== undefined ? { dimension: this.requiredString(dto.dimension, 'dimension') } : {}),
      ...(dto.conditions !== undefined ? { conditions: this.requiredJson(dto.conditions, 'conditions') } : {}),
      ...(dto.effect !== undefined ? { effect: this.effect(dto.effect) } : {}),
      ...(dto.priority !== undefined ? { priority: this.optionalInteger(dto.priority, 'priority', 0) } : {}),
    });
    if (!policy) throw new NotFoundException('ABAC policy not found');
    return this.toAbacPolicyView(policy);
  }

  async createFieldAccessPolicy(tenantId: Uuid, dto: CreateFieldAccessPolicyDto): Promise<FieldAccessPolicyView> {
    const policy = await this.repository.createFieldAccessPolicy(tenantId, {
      field_path: this.requiredString(dto.fieldPath, 'fieldPath'),
      data_classification: this.requiredString(dto.dataClassification, 'dataClassification'),
      role_decisions: this.requiredJson(dto.roleDecisions, 'roleDecisions'),
      self_service_decision: this.optionalString(dto.selfServiceDecision),
      manager_decision: this.optionalString(dto.managerDecision),
      masking_rule: this.optionalString(dto.maskingRule),
    });
    return this.toFieldAccessPolicyView(policy);
  }

  async updateFieldAccessPolicy(tenantId: Uuid, policyId: Uuid, dto: UpdateFieldAccessPolicyDto): Promise<FieldAccessPolicyView> {
    const policy = await this.repository.updateFieldAccessPolicy(tenantId, policyId, {
      ...(dto.fieldPath !== undefined ? { field_path: this.requiredString(dto.fieldPath, 'fieldPath') } : {}),
      ...(dto.dataClassification !== undefined ? { data_classification: this.requiredString(dto.dataClassification, 'dataClassification') } : {}),
      ...(dto.roleDecisions !== undefined ? { role_decisions: this.requiredJson(dto.roleDecisions, 'roleDecisions') } : {}),
      ...(dto.selfServiceDecision !== undefined ? { self_service_decision: this.optionalString(dto.selfServiceDecision) } : {}),
      ...(dto.managerDecision !== undefined ? { manager_decision: this.optionalString(dto.managerDecision) } : {}),
      ...(dto.maskingRule !== undefined ? { masking_rule: this.optionalString(dto.maskingRule) } : {}),
    });
    if (!policy) throw new NotFoundException('Field access policy not found');
    return this.toFieldAccessPolicyView(policy);
  }

  async createSodRule(tenantId: Uuid, dto: CreateSodRuleDto): Promise<SodRuleView> {
    const rule = await this.repository.createSodRule(tenantId, {
      code: this.requiredCode(dto.code, 'code'),
      description: this.optionalString(dto.description),
      incompatible_role_pairs: this.nullableJsonbValue(dto.incompatibleRolePairs),
      incompatible_permission_pairs: this.nullableJsonbValue(dto.incompatiblePermissionPairs),
      enforcement_point: this.optionalString(dto.enforcementPoint),
      break_glass_allowed: dto.breakGlassAllowed ?? false,
    });
    return this.toSodRuleView(rule);
  }

  async updateSodRule(tenantId: Uuid, ruleId: Uuid, dto: UpdateSodRuleDto): Promise<SodRuleView> {
    const rule = await this.repository.updateSodRule(tenantId, ruleId, {
      ...(dto.code !== undefined ? { code: this.requiredCode(dto.code, 'code') } : {}),
      ...(dto.description !== undefined ? { description: this.optionalString(dto.description) } : {}),
      ...(dto.incompatibleRolePairs !== undefined ? { incompatible_role_pairs: this.nullableJsonbValue(dto.incompatibleRolePairs) } : {}),
      ...(dto.incompatiblePermissionPairs !== undefined ? { incompatible_permission_pairs: this.nullableJsonbValue(dto.incompatiblePermissionPairs) } : {}),
      ...(dto.enforcementPoint !== undefined ? { enforcement_point: this.optionalString(dto.enforcementPoint) } : {}),
      ...(dto.breakGlassAllowed !== undefined ? { break_glass_allowed: Boolean(dto.breakGlassAllowed) } : {}),
    });
    if (!rule) throw new NotFoundException('SoD rule not found');
    return this.toSodRuleView(rule);
  }

  async remediateSodViolation(
    tenantId: Uuid,
    dto: RemediateSodViolationDto,
    actorId?: Uuid,
  ): Promise<SodRemediationView> {
    const ruleId = this.uuid(this.requiredString(dto.ruleId, 'ruleId'), 'ruleId');
    const subjectUserId = this.uuid(this.requiredString(dto.subjectUserId, 'subjectUserId'), 'subjectUserId');
    const violatingRoleId = this.uuid(this.requiredString(dto.violatingRoleId, 'violatingRoleId'), 'violatingRoleId');
    const conflictingRoleId = this.uuid(this.requiredString(dto.conflictingRoleId, 'conflictingRoleId'), 'conflictingRoleId');
    const action = this.enumValue(dto.action ?? 'DOCUMENT_EXCEPTION', SOD_REMEDIATION_ACTIONS, 'action') as SodRemediationAction;
    const rule = (await this.repository.listSodRules(tenantId)).find((candidate) => candidate.id === ruleId.value);
    if (!rule) throw new NotFoundException('SoD rule not found');
    this.assertSodRolePairCovered(rule, violatingRoleId.value, conflictingRoleId.value);

    const removedRoleId = action === 'REMOVE_VIOLATING_ROLE'
      ? violatingRoleId
      : action === 'REMOVE_CONFLICTING_ROLE'
        ? conflictingRoleId
        : null;
    const retainedRoleId = action === 'REMOVE_VIOLATING_ROLE'
      ? conflictingRoleId
      : action === 'REMOVE_CONFLICTING_ROLE'
        ? violatingRoleId
        : null;
    if (removedRoleId) {
      await this.repository.removeUserRole(tenantId, subjectUserId, removedRoleId);
      await this.syncUserAccess(tenantId, subjectUserId);
    }

    const remediatedAt = new Date();
    const evidence = this.withSodRemediationEvidence(dto.evidence, rule, action, removedRoleId?.value ?? null, retainedRoleId?.value ?? null);
    const remediation: SodRemediationView = {
      ruleId: rule.id,
      ruleCode: rule.code,
      subjectUserId: subjectUserId.value,
      action,
      removedRoleId: removedRoleId?.value ?? null,
      retainedRoleId: retainedRoleId?.value ?? null,
      evidence,
      remediatedBy: actorId?.value ?? null,
      remediatedAt: remediatedAt.toISOString(),
      externalWorkflowBoundary: 'RECORDED_FOR_GRC_OR_TICKETING_HANDOFF',
    };

    await this.recordGovernanceEvent(tenantId, {
      eventName: 'SodViolationRemediated',
      aggregateType: 'SodRule',
      aggregateId: ruleId,
      actorId,
      payload: {
        ...this.evidenceRecord(dto.evidence),
        ...remediation,
      },
    });

    return remediation;
  }

  private async getAccessReviewCampaignOrThrow(tenantId: Uuid, campaignId: Uuid): Promise<AccessReviewCampaignRecord> {
    const campaign = await this.repository.findAccessReviewCampaign(tenantId, campaignId);
    if (!campaign) throw new NotFoundException('Access review campaign not found');
    return campaign;
  }

  private async pendingAccessReviewItemCount(tenantId: Uuid, campaignId: Uuid): Promise<number> {
    return (await this.pendingAccessReviewItems(tenantId, campaignId)).length;
  }

  private async pendingAccessReviewItems(tenantId: Uuid, campaignId: Uuid): Promise<AccessReviewItemRecord[]> {
    const items = await this.repository.listAccessReviewItemsForCampaign(tenantId, campaignId);
    return items.filter((item) => item.decision === 'PENDING');
  }

  private accessReviewPendingPayload(
    campaign: AccessReviewCampaignRecord,
    pendingItems: AccessReviewItemRecord[],
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const assignedReviewerIds = Array.from(
      new Set(pendingItems.map((item) => item.reviewer_id).filter((reviewerId): reviewerId is string => Boolean(reviewerId))),
    );
    return {
      campaignCode: campaign.code,
      reviewerRole: campaign.reviewer_role,
      dueAt: this.date(campaign.due_at),
      pendingItemIds: pendingItems.map((item) => item.id),
      assignedReviewerIds,
      unassignedItemCount: pendingItems.filter((item) => !item.reviewer_id).length,
      ...extra,
    };
  }

  private async fulfillAccessReviewRevocation(
    tenantId: Uuid,
    item: AccessReviewItemRecord,
    actorId?: Uuid,
  ): Promise<void> {
    if (item.subject_user_id && item.role_id) {
      const subjectUserId = new Uuid(item.subject_user_id);
      await this.repository.removeUserRole(tenantId, subjectUserId, new Uuid(item.role_id));
      await this.syncUserAccess(tenantId, subjectUserId);
      await this.createAccessReviewWorkflowEvent(tenantId, new Uuid(item.campaign_id), {
        eventType: 'REVOKE_FULFILLED',
        actorId,
        targetRole: null,
        message: 'Access review revoke decision fulfilled',
        pendingItemCount: await this.pendingAccessReviewItemCount(tenantId, new Uuid(item.campaign_id)),
        payload: {
          action: 'USER_ROLE_REMOVED',
          itemId: item.id,
          subjectUserId: item.subject_user_id,
          roleId: item.role_id,
          roleCode: item.role_code,
        },
      });
      return;
    }

    if (item.service_account_id) {
      const serviceAccountId = new Uuid(item.service_account_id);
      const credentialIdsRevoked = await this.revokeActiveServiceAccountCredentials(tenantId, serviceAccountId);
      await this.repository.updateServiceAccount(tenantId, serviceAccountId, { status: 'DISABLED' });
      await this.createAccessReviewWorkflowEvent(tenantId, new Uuid(item.campaign_id), {
        eventType: 'REVOKE_FULFILLED',
        actorId,
        targetRole: null,
        message: 'Access review revoke decision fulfilled',
        pendingItemCount: await this.pendingAccessReviewItemCount(tenantId, new Uuid(item.campaign_id)),
        payload: {
          action: 'SERVICE_ACCOUNT_DISABLED',
          itemId: item.id,
          serviceAccountId: item.service_account_id,
          serviceAccountCode: item.service_account_code,
          credentialIdsRevoked,
        },
      });
    }
  }

  private async revokeActiveServiceAccountCredentials(tenantId: Uuid, serviceAccountId: Uuid): Promise<string[]> {
    const credentials = await this.repository.listServiceAccountCredentials(tenantId);
    const activeCredentials = credentials.filter((credential) => (
      credential.service_account_id === serviceAccountId.value
      && credential.status === 'ACTIVE'
    ));
    const revokedAt = new Date();
    for (const credential of activeCredentials) {
      await this.repository.updateServiceAccountCredential(tenantId, serviceAccountId, new Uuid(credential.id), {
        status: 'REVOKED',
        revoked_at: revokedAt,
        revoked_reason: 'Access review revoke decision fulfilled',
      });
    }
    return activeCredentials.map((credential) => credential.id);
  }

  private async createAccessReviewWorkflowEvent(
    tenantId: Uuid,
    campaignId: Uuid,
    input: {
      eventType: string;
      actorId?: Uuid;
      targetRole: string | null;
      message: string | null;
      pendingItemCount: number;
      payload: unknown;
    },
  ): Promise<AccessReviewWorkflowEventView> {
    const eventType = this.enumValue(input.eventType, ACCESS_REVIEW_WORKFLOW_EVENTS, 'eventType');
    const event = await this.repository.createAccessReviewWorkflowEvent(tenantId, {
      campaign_id: campaignId.value,
      event_type: eventType,
      actor_id: input.actorId?.value ?? null,
      target_role: input.targetRole,
      message: input.message,
      pending_item_count: input.pendingItemCount,
      payload: input.payload ?? {},
    });
    await this.recordGovernanceEvent(tenantId, {
      eventName: `AccessReview${this.toPascalCase(eventType)}`,
      aggregateType: 'AccessReviewCampaign',
      aggregateId: campaignId,
      actorId: input.actorId,
      payload: {
        campaignId: campaignId.value,
        eventType,
        targetRole: input.targetRole,
        message: input.message,
        pendingItemCount: input.pendingItemCount,
        payload: input.payload ?? {},
      },
    });
    return this.toAccessReviewWorkflowEventView(event);
  }

  private generateOneTimeSecret(): { oneTimeSecret: string; secretPrefix: string; secretHash: string } {
    const oneTimeSecret = `hcm_sa_${randomBytes(32).toString('base64url')}`;
    return {
      oneTimeSecret,
      secretPrefix: oneTimeSecret.slice(0, 16),
      secretHash: createHash('sha256').update(oneTimeSecret).digest('hex'),
    };
  }

  private withReviewerAssignmentEvidence(value: unknown, reviewerId: string | null): Record<string, unknown> {
    return {
      ...this.evidenceRecord(value),
      assignment: {
        reviewerId,
        assignmentState: reviewerId ? 'ASSIGNED' : 'UNASSIGNED',
      },
    };
  }

  private withDecisionEvidence(
    value: unknown,
    decision: string,
    reviewerId: string | null,
    decidedAt: Date,
  ): Record<string, unknown> {
    return {
      ...this.evidenceRecord(value),
      decision: {
        value: decision,
        decidedBy: reviewerId,
        decidedAt: decidedAt.toISOString(),
        revokeFulfillmentBoundary: decision === 'REVOKE' ? 'LOCAL_ACCESS_STATE_ONLY' : null,
      },
    };
  }

  private withSodRemediationEvidence(
    value: unknown,
    rule: SodRuleRecord,
    action: SodRemediationAction,
    removedRoleId: string | null,
    retainedRoleId: string | null,
  ): Record<string, unknown> {
    return {
      ...this.evidenceRecord(value),
      sodRule: {
        ruleId: rule.id,
        ruleCode: rule.code,
        enforcementPoint: rule.enforcement_point,
      },
      remediation: {
        action,
        removedRoleId,
        retainedRoleId,
        externalWorkflowBoundary: 'RECORDED_FOR_GRC_OR_TICKETING_HANDOFF',
      },
    };
  }

  private evidenceRecord(value: unknown): Record<string, unknown> {
    if (value === undefined || value === null) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return { ...(value as Record<string, unknown>) };
    return { value };
  }

  private assertSodRolePairCovered(rule: SodRuleRecord, roleA: string, roleB: string): void {
    const rolePairs = this.sodRolePairs(rule.incompatible_role_pairs);
    if (rolePairs.length === 0) return;
    const matches = rolePairs.some(([left, right]) => (
      (left === roleA && right === roleB) || (left === roleB && right === roleA)
    ));
    if (!matches) {
      throw new BadRequestException('SoD remediation role pair does not match the selected rule');
    }
  }

  private sodRolePairs(value: unknown): Array<[string, string]> {
    const parsed = this.parseJsonLike(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((pair): pair is [string, string] => (
        Array.isArray(pair)
        && typeof pair[0] === 'string'
        && typeof pair[1] === 'string'
      ))
      .map(([left, right]) => [left, right]);
  }

  private parseJsonLike(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }

  private async recordGovernanceEvent(
    tenantId: Uuid,
    input: {
      eventName: string;
      aggregateType: string;
      aggregateId: Uuid;
      actorId?: Uuid;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    if (!this.auditLedger || !this.outbox) return;

    const correlationId = Uuid.generate();
    const actorId = input.actorId ?? Uuid.generate();
    const payload = {
      governanceArea: 'ACCESS_GOVERNANCE',
      actorId: input.actorId?.value ?? null,
      ...input.payload,
    };

    await this.auditLedger.write({
      id: Uuid.generate(),
      tenantId,
      actorType: input.actorId ? 'USER' : 'SYSTEM',
      actorId,
      action: input.eventName,
      resourceType: input.aggregateType,
      resourceId: input.aggregateId,
      payload,
      occurredAt: new Date(),
      correlationId,
      dataClassification: 'CONFIDENTIAL',
      legalHoldStatus: 'NONE',
      retentionClass: 'EXTENDED',
    });

    const event: HrEventEnvelope<Record<string, unknown>> = {
      eventId: Uuid.generate(),
      eventName: input.eventName,
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload,
      metadata: {
        correlationId,
        requestHash: `${input.eventName}:${input.aggregateType}:${input.aggregateId.value}:${Date.now()}`,
        clientType: 'HR_ADMIN',
        hrDataSensitivity: 'LOW',
      },
      privacy: createPrivacyForEvent('LOW', undefined, 'PROFILE'),
      occurredAt: new Date(),
      version: 1,
    };

    await this.outbox.schedule(event, tenantId, correlationId);
  }

  private toPascalCase(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private requiredCode(value: unknown, field: string): string {
    return this.requiredString(value, field).toUpperCase().replace(/\s+/g, '_');
  }

  private optionalString(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return String(value);
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private requiredJson(value: unknown, field: string): unknown {
    if (value === undefined || value === null) {
      throw new BadRequestException(`${field} is required`);
    }
    return value;
  }

  private jsonbValue(value: unknown): unknown {
    return Array.isArray(value) ? JSON.stringify(value) : value;
  }

  private nullableJsonbValue(value: unknown | null | undefined): unknown | null {
    if (value === undefined || value === null) return null;
    return this.jsonbValue(value);
  }

  private effect(value: unknown): 'ALLOW' | 'DENY' {
    if (typeof value === 'string' && EFFECTS.has(value)) return value as 'ALLOW' | 'DENY';
    throw new BadRequestException('effect must be ALLOW or DENY');
  }

  private enumValue(value: unknown, allowed: Set<string>, field: string): string {
    if (typeof value !== 'string') throw new BadRequestException(`${field} must be a string`);
    const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');
    if (!allowed.has(normalized)) {
      throw new BadRequestException(`${field} must be one of ${Array.from(allowed).join(', ')}`);
    }
    return normalized;
  }

  private optionalInteger(value: unknown, field: string, fallback: number): number {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new BadRequestException(`${field} must be an integer`);
    return parsed;
  }

  private uuid(value: string, field: string): Uuid {
    if (!Uuid.isValid(value)) throw new BadRequestException(`${field} must contain valid UUID values`);
    return new Uuid(value);
  }

  private optionalUuidValue(value: unknown, field: string): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !Uuid.isValid(value)) {
      throw new BadRequestException(`${field} must be a valid UUID`);
    }
    return value;
  }

  private optionalDate(value: unknown): Date | null {
    if (value === undefined || value === null || value === '') return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Date value is invalid');
    return date;
  }

  private date(value: Date | string | null): string | null {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  private toRoleView(role: RoleRecord): RoleView {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      tier: role.tier,
      description: role.description,
      isSystem: role.is_system,
      createdAt: this.date(role.created_at) ?? '',
    };
  }

  private toPermissionView(permission: PermissionRecord): PermissionView {
    return {
      id: permission.id,
      code: permission.code,
      description: permission.description,
      domain: permission.domain,
      dataClassification: permission.data_classification,
      auditOnAccess: permission.audit_on_access,
    };
  }

  private toRolePermissionView(assignment: RolePermissionRecord): RolePermissionView {
    return {
      roleId: assignment.role_id,
      permissionId: assignment.permission_id,
      roleCode: assignment.role_code,
      permissionCode: assignment.permission_code,
    };
  }

  private toUserRoleView(assignment: UserRoleRecord): UserRoleView {
    return {
      id: assignment.id,
      userId: assignment.user_id,
      roleId: assignment.role_id ?? '',
      roleCode: assignment.role_code,
      assignedBy: assignment.assigned_by,
      assignedAt: this.date(assignment.assigned_at) ?? '',
      expiresAt: this.date(assignment.expires_at),
    };
  }

  private toServiceAccountView(account: ServiceAccountRecord): ServiceAccountView {
    return {
      id: account.id,
      code: account.code,
      name: account.name,
      ownerWorkerId: account.owner_worker_id,
      status: account.status,
      scopes: account.scopes,
      credentialRotationDays: account.credential_rotation_days,
      lastRotatedAt: this.date(account.last_rotated_at),
      expiresAt: this.date(account.expires_at),
      createdBy: account.created_by,
      createdAt: this.date(account.created_at) ?? '',
      updatedAt: this.date(account.updated_at) ?? '',
    };
  }

  private toServiceAccountCredentialView(credential: ServiceAccountCredentialRecord): ServiceAccountCredentialView {
    return {
      id: credential.id,
      serviceAccountId: credential.service_account_id,
      name: credential.name,
      secretPrefix: credential.secret_prefix,
      status: credential.status,
      scopes: credential.scopes,
      issuedAt: this.date(credential.issued_at) ?? '',
      expiresAt: this.date(credential.expires_at),
      lastUsedAt: this.date(credential.last_used_at),
      rotatedAt: this.date(credential.rotated_at),
      revokedAt: this.date(credential.revoked_at),
      revokedReason: credential.revoked_reason,
      credentialLifecycle: this.toCredentialLifecycleView(credential),
      createdBy: credential.created_by,
      createdAt: this.date(credential.created_at) ?? '',
      updatedAt: this.date(credential.updated_at) ?? '',
    };
  }

  private toCredentialLifecycleView(credential: ServiceAccountCredentialRecord): ServiceAccountCredentialLifecycleView {
    return {
      storageMode: 'HASH_ONLY_EXTERNAL_VAULT_READY',
      secretMaterialState: this.credentialSecretMaterialState(credential.status),
      // This service deliberately stores hash-only metadata; real secret material remains an external vault integration boundary.
      externalVaultBoundary: 'PENDING_EXTERNAL_VAULT_INTEGRATION',
      vaultSecretRef: null,
      rotationDueAt: this.date(credential.expires_at),
    };
  }

  private credentialSecretMaterialState(status: string): ServiceAccountCredentialLifecycleView['secretMaterialState'] {
    if (status === 'ROTATED') return 'ROTATED_HASH_RETAINED';
    if (status === 'REVOKED') return 'REVOKED_HASH_RETAINED';
    if (status === 'EXPIRED') return 'EXPIRED_HASH_RETAINED';
    return 'HASH_ONLY_RETAINED';
  }

  private toAccessReviewCampaignView(campaign: AccessReviewCampaignRecord): AccessReviewCampaignView {
    return {
      id: campaign.id,
      code: campaign.code,
      name: campaign.name,
      scope: campaign.scope,
      reviewerRole: campaign.reviewer_role,
      status: campaign.status,
      dueAt: this.date(campaign.due_at),
      createdBy: campaign.created_by,
      launchedAt: this.date(campaign.launched_at),
      lastReminderAt: this.date(campaign.last_reminder_at),
      escalatedAt: this.date(campaign.escalated_at),
      escalationCount: campaign.escalation_count,
      completedAt: this.date(campaign.completed_at),
      createdAt: this.date(campaign.created_at) ?? '',
      updatedAt: this.date(campaign.updated_at) ?? '',
    };
  }

  private toAccessReviewItemView(item: AccessReviewItemRecord): AccessReviewItemView {
    return {
      id: item.id,
      campaignId: item.campaign_id,
      subjectUserId: item.subject_user_id,
      subjectWorkerId: item.subject_worker_id,
      roleId: item.role_id,
      roleCode: item.role_code,
      permissionId: item.permission_id,
      permissionCode: item.permission_code,
      serviceAccountId: item.service_account_id,
      serviceAccountCode: item.service_account_code,
      decision: item.decision,
      reviewerId: item.reviewer_id,
      reviewedAt: this.date(item.reviewed_at),
      evidence: item.evidence,
      createdAt: this.date(item.created_at) ?? '',
    };
  }

  private toAccessReviewWorkflowEventView(event: AccessReviewWorkflowEventRecord): AccessReviewWorkflowEventView {
    return {
      id: event.id,
      campaignId: event.campaign_id,
      eventType: event.event_type,
      actorId: event.actor_id,
      targetRole: event.target_role,
      message: event.message,
      pendingItemCount: event.pending_item_count,
      payload: event.payload,
      createdAt: this.date(event.created_at) ?? '',
    };
  }

  private toAbacPolicyView(policy: AbacPolicyRecord): AbacPolicyView {
    return {
      id: policy.id,
      dimension: policy.dimension,
      conditions: policy.conditions,
      effect: policy.effect as 'ALLOW' | 'DENY',
      priority: policy.priority,
      createdAt: this.date(policy.created_at) ?? '',
    };
  }

  private toFieldAccessPolicyView(policy: FieldAccessPolicyRecord): FieldAccessPolicyView {
    return {
      id: policy.id,
      fieldPath: policy.field_path,
      dataClassification: policy.data_classification,
      roleDecisions: policy.role_decisions,
      selfServiceDecision: policy.self_service_decision,
      managerDecision: policy.manager_decision,
      maskingRule: policy.masking_rule,
      createdAt: this.date(policy.created_at) ?? '',
    };
  }

  private toSodRuleView(rule: SodRuleRecord): SodRuleView {
    return {
      id: rule.id,
      code: rule.code,
      description: rule.description,
      incompatibleRolePairs: rule.incompatible_role_pairs,
      incompatiblePermissionPairs: rule.incompatible_permission_pairs,
      enforcementPoint: rule.enforcement_point,
      breakGlassAllowed: rule.break_glass_allowed,
      createdAt: this.date(rule.created_at) ?? '',
    };
  }
}
