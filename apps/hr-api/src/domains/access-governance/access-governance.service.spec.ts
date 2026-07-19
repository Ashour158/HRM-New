import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { AccessGovernanceService } from './access-governance.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const assignedReviewerId = new Uuid('00000000-0000-0000-0000-000000000011');
const serviceAccountId = new Uuid('00000000-0000-0000-0000-000000000020');
const campaignId = new Uuid('00000000-0000-0000-0000-000000000030');
const sodRuleId = new Uuid('00000000-0000-0000-0000-0000000000a0');

function serviceAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: serviceAccountId.value,
    tenant_id: tenantId.value,
    code: 'PAYROLL_EXPORT_BOT',
    name: 'Payroll Export Bot',
    owner_worker_id: null,
    status: 'ACTIVE',
    scopes: ['payroll:export'],
    credential_rotation_days: 90,
    last_rotated_at: null,
    expires_at: null,
    created_by: actorId.value,
    created_at: new Date('2026-06-03T00:00:00.000Z'),
    updated_at: new Date('2026-06-03T00:00:00.000Z'),
    ...overrides,
  };
}

function credential(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000040',
    tenant_id: tenantId.value,
    service_account_id: serviceAccountId.value,
    name: 'Payroll API key',
    secret_hash: 'sha256-not-plain',
    secret_prefix: 'hcm_sa_example',
    status: 'ACTIVE',
    scopes: ['payroll:export'],
    issued_at: new Date('2026-06-03T00:00:00.000Z'),
    expires_at: new Date('2026-07-03T00:00:00.000Z'),
    last_used_at: null,
    rotated_at: null,
    revoked_at: null,
    revoked_reason: null,
    created_by: actorId.value,
    created_at: new Date('2026-06-03T00:00:00.000Z'),
    updated_at: new Date('2026-06-03T00:00:00.000Z'),
    ...overrides,
  };
}

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: campaignId.value,
    tenant_id: tenantId.value,
    code: 'Q2_PRIVILEGED_ACCESS',
    name: 'Q2 Privileged Access',
    scope: { roles: ['HR_ADMIN'] },
    reviewer_role: 'COMPLIANCE_OFFICER',
    status: 'IN_REVIEW',
    due_at: new Date('2026-06-10T00:00:00.000Z'),
    created_by: actorId.value,
    launched_at: new Date('2026-06-03T00:00:00.000Z'),
    last_reminder_at: null,
    escalated_at: null,
    escalation_count: 0,
    completed_at: null,
    created_at: new Date('2026-06-03T00:00:00.000Z'),
    updated_at: new Date('2026-06-03T00:00:00.000Z'),
    ...overrides,
  };
}

function reviewItem(decision: string, overrides: Record<string, unknown> = {}) {
  return {
    id: Uuid.generate().value,
    tenant_id: tenantId.value,
    campaign_id: campaignId.value,
    subject_user_id: '00000000-0000-0000-0000-000000000050',
    subject_worker_id: null,
    role_id: null,
    role_code: null,
    permission_id: null,
    permission_code: null,
    service_account_id: null,
    service_account_code: null,
    decision,
    reviewer_id: null,
    reviewed_at: null,
    evidence: {},
    created_at: new Date('2026-06-03T00:00:00.000Z'),
    ...overrides,
  };
}

function workflowEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000060',
    tenant_id: tenantId.value,
    campaign_id: campaignId.value,
    event_type: 'REMINDER_SENT',
    actor_id: actorId.value,
    target_role: 'COMPLIANCE_OFFICER',
    message: 'Reminder sent',
    pending_item_count: 1,
    payload: {},
    created_at: new Date('2026-06-03T00:00:00.000Z'),
    ...overrides,
  };
}

function sodRule(overrides: Record<string, unknown> = {}) {
  return {
    id: sodRuleId.value,
    tenant_id: tenantId.value,
    code: 'PAYROLL_REQUEST_APPROVE',
    description: 'Payroll request and approval duties must be separated',
    incompatible_role_pairs: [[
      '00000000-0000-0000-0000-000000000090',
      '00000000-0000-0000-0000-000000000091',
    ]],
    incompatible_permission_pairs: null,
    enforcement_point: 'ROLE_ASSIGNMENT',
    break_glass_allowed: false,
    created_at: new Date('2026-06-03T00:00:00.000Z'),
    ...overrides,
  };
}

function repository(overrides: Record<string, unknown> = {}) {
  return {
    listRoles: vi.fn(async () => []),
    listPermissions: vi.fn(async () => []),
    listRolePermissions: vi.fn(async () => []),
    listUserRoles: vi.fn(async () => []),
    listServiceAccounts: vi.fn(async () => [serviceAccount()]),
    listServiceAccountCredentials: vi.fn(async () => []),
    listAccessReviewCampaigns: vi.fn(async () => [campaign()]),
    listAccessReviewItems: vi.fn(async () => []),
    listAccessReviewWorkflowEvents: vi.fn(async () => []),
    listAbacPolicies: vi.fn(async () => []),
    listFieldAccessPolicies: vi.fn(async () => []),
    listSodRules: vi.fn(async () => [sodRule()]),
    findServiceAccount: vi.fn(async () => serviceAccount()),
    findServiceAccountCredential: vi.fn(async () => credential()),
    createServiceAccountCredential: vi.fn(async (_tenant: Uuid, input: Record<string, unknown>) => credential(input)),
    updateServiceAccountCredential: vi.fn(async (_tenant: Uuid, _account: Uuid, _credential: Uuid, input: Record<string, unknown>) => credential(input)),
    updateServiceAccount: vi.fn(async (_tenant: Uuid, _account: Uuid, input: Record<string, unknown>) => serviceAccount(input)),
    assignUserRole: vi.fn(async () => []),
    removeUserRole: vi.fn(async () => []),
    replaceRolePermissions: vi.fn(async () => []),
    assignRolePermission: vi.fn(async () => undefined),
    removeRolePermission: vi.fn(async () => undefined),
    computeEffectiveUserAccess: vi.fn(async () => ({ roles: [], permissions: [] })),
    listUserIdsForRole: vi.fn(async () => []),
    findAccessReviewCampaign: vi.fn(async () => campaign()),
    listAccessReviewItemsForCampaign: vi.fn(async () => []),
    updateAccessReviewCampaign: vi.fn(async (_tenant: Uuid, _campaign: Uuid, input: Record<string, unknown>) => campaign(input)),
    createAccessReviewItem: vi.fn(async (_tenant: Uuid, input: Record<string, unknown>) => [reviewItem(String(input.decision ?? 'PENDING'), input)]),
    updateAccessReviewItem: vi.fn(async (_tenant: Uuid, _itemId: Uuid, input: Record<string, unknown>) => reviewItem(String(input.decision ?? 'PENDING'), input)),
    createAccessReviewWorkflowEvent: vi.fn(async (_tenant: Uuid, input: Record<string, unknown>) => workflowEvent(input)),
    ...overrides,
  };
}

describe('AccessGovernanceService credential vault and certification workflow', () => {
  it('issues a service account credential as a one-time secret while storing only a hash', async () => {
    const repo = repository();
    const service = new AccessGovernanceService(repo as never) as unknown as {
      issueServiceAccountCredential: AccessGovernanceService['issueServiceAccountCredential'];
    };

    const result = await service.issueServiceAccountCredential(tenantId, serviceAccountId, {
      name: 'Payroll API key',
      scopes: ['payroll:export'],
      expiresAt: '2026-07-03T00:00:00.000Z',
    }, actorId);

    const storedInput = vi.mocked(repo.createServiceAccountCredential).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(result.oneTimeSecret).toMatch(/^hcm_sa_/);
    expect(result.secretPrefix).toBe(result.oneTimeSecret.slice(0, 16));
    expect(storedInput.secret_hash).not.toBe(result.oneTimeSecret);
    expect(String(storedInput.secret_hash)).toHaveLength(64);
    expect(JSON.stringify(result)).not.toContain(String(storedInput.secret_hash));
  });

  it('returns vault-ready credential lifecycle metadata without exposing external vault material', async () => {
    const repo = repository();
    const service = new AccessGovernanceService(repo as never) as unknown as {
      issueServiceAccountCredential: AccessGovernanceService['issueServiceAccountCredential'];
    };

    const result = await service.issueServiceAccountCredential(tenantId, serviceAccountId, {}, actorId);

    expect(result.credentialLifecycle).toEqual(expect.objectContaining({
      storageMode: 'HASH_ONLY_EXTERNAL_VAULT_READY',
      secretMaterialState: 'ONE_TIME_SECRET_RETURNED',
      externalVaultBoundary: 'PENDING_EXTERNAL_VAULT_INTEGRATION',
      vaultSecretRef: null,
    }));
    expect(JSON.stringify(result.credentialLifecycle)).not.toContain(result.oneTimeSecret);
  });

  it('does not complete an access review campaign while certification items are pending', async () => {
    const repo = repository({
      listAccessReviewItemsForCampaign: vi.fn(async () => [
        reviewItem('APPROVED'),
        reviewItem('PENDING'),
      ]),
    });
    const service = new AccessGovernanceService(repo as never) as unknown as {
      completeAccessReviewCampaign: AccessGovernanceService['completeAccessReviewCampaign'];
    };

    await expect(service.completeAccessReviewCampaign(tenantId, campaignId, actorId))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updateAccessReviewCampaign).not.toHaveBeenCalled();
  });

  it('records reminder and escalation workflow events for pending access review items', async () => {
    const repo = repository({
      listAccessReviewItemsForCampaign: vi.fn(async () => [
        reviewItem('PENDING', {
          id: '00000000-0000-0000-0000-000000000071',
          reviewer_id: assignedReviewerId.value,
        }),
        reviewItem('APPROVED'),
      ]),
    });
    const service = new AccessGovernanceService(repo as never) as unknown as {
      sendAccessReviewReminders: AccessGovernanceService['sendAccessReviewReminders'];
      escalateAccessReviewCampaign: AccessGovernanceService['escalateAccessReviewCampaign'];
    };

    const reminder = await service.sendAccessReviewReminders(tenantId, campaignId, { message: 'Please certify access.' }, actorId);
    const escalation = await service.escalateAccessReviewCampaign(tenantId, campaignId, { message: 'Overdue certification.' }, actorId);

    expect(reminder.eventType).toBe('REMINDER_SENT');
    expect(reminder.pendingItemCount).toBe(1);
    expect(reminder.payload).toEqual(expect.objectContaining({
      pendingItemIds: ['00000000-0000-0000-0000-000000000071'],
      assignedReviewerIds: [assignedReviewerId.value],
      unassignedItemCount: 0,
    }));
    expect(escalation.eventType).toBe('ESCALATED');
    expect(escalation.pendingItemCount).toBe(1);
    expect(escalation.payload).toEqual(expect.objectContaining({
      pendingItemIds: ['00000000-0000-0000-0000-000000000071'],
      assignedReviewerIds: [assignedReviewerId.value],
      escalationCount: 1,
    }));
    expect(repo.createAccessReviewWorkflowEvent).toHaveBeenCalledTimes(2);
    expect(repo.updateAccessReviewCampaign).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      expect.objectContaining({ escalation_count: 1 }),
    );
  });

  it('creates certification items with reviewer assignments for targeted campaigns', async () => {
    const repo = repository();
    const service = new AccessGovernanceService(repo as never) as unknown as {
      createAccessReviewItem: AccessGovernanceService['createAccessReviewItem'];
    };

    await service.createAccessReviewItem(tenantId, {
      campaignId: campaignId.value,
      subjectUserId: '00000000-0000-0000-0000-000000000050',
      roleId: '00000000-0000-0000-0000-000000000090',
      reviewerId: assignedReviewerId.value,
      evidence: { source: 'quarterly-certification' },
    });

    expect(repo.createAccessReviewItem).toHaveBeenCalledWith(tenantId, expect.objectContaining({
      reviewer_id: assignedReviewerId.value,
      evidence: expect.objectContaining({
        source: 'quarterly-certification',
        assignment: expect.objectContaining({
          reviewerId: assignedReviewerId.value,
          assignmentState: 'ASSIGNED',
        }),
      }),
    }));
  });

  it('preserves assigned reviewers and records decision evidence when a system process applies the decision', async () => {
    const itemId = new Uuid('00000000-0000-0000-0000-000000000072');
    const repo = repository({
      updateAccessReviewItem: vi.fn(async (_tenant: Uuid, _item: Uuid, input: Record<string, unknown>) => reviewItem('APPROVED', {
        id: itemId.value,
        reviewer_id: assignedReviewerId.value,
        reviewed_at: input.reviewed_at,
        evidence: input.evidence,
      })),
    });
    const service = new AccessGovernanceService(repo as never) as unknown as {
      updateAccessReviewItem: AccessGovernanceService['updateAccessReviewItem'];
    };

    const result = await service.updateAccessReviewItem(tenantId, itemId, {
      decision: 'APPROVED',
      evidence: { ticketId: 'GRC-42' },
    });

    const updateInput = vi.mocked(repo.updateAccessReviewItem).mock.calls[0]?.[2] as Record<string, unknown>;
    expect(updateInput).not.toHaveProperty('reviewer_id');
    expect(updateInput.evidence).toEqual(expect.objectContaining({
      ticketId: 'GRC-42',
      decision: expect.objectContaining({
        value: 'APPROVED',
        decidedBy: null,
      }),
    }));
    expect(result.reviewerId).toBe(assignedReviewerId.value);
  });

  it('fulfills revoke certification decisions by removing the granted role and writing workflow evidence', async () => {
    const itemId = new Uuid('00000000-0000-0000-0000-000000000070');
    const userId = '00000000-0000-0000-0000-000000000080';
    const roleId = '00000000-0000-0000-0000-000000000090';
    const repo = repository({
      updateAccessReviewItem: vi.fn(async () => reviewItem('REVOKE', {
        id: itemId.value,
        subject_user_id: userId,
        role_id: roleId,
        role_code: 'PAYROLL_ADMIN',
        evidence: { reviewerComment: 'No longer needed' },
      })),
    });
    const service = new AccessGovernanceService(repo as never) as unknown as {
      updateAccessReviewItem: AccessGovernanceService['updateAccessReviewItem'];
    };

    const result = await service.updateAccessReviewItem(tenantId, itemId, { decision: 'REVOKE' }, actorId);

    expect(result.decision).toBe('REVOKE');
    expect(repo.removeUserRole).toHaveBeenCalledWith(tenantId, new Uuid(userId), new Uuid(roleId));
    expect(repo.createAccessReviewWorkflowEvent).toHaveBeenCalledWith(tenantId, expect.objectContaining({
      campaign_id: campaignId.value,
      event_type: 'REVOKE_FULFILLED',
      actor_id: actorId.value,
      message: 'Access review revoke decision fulfilled',
      payload: expect.objectContaining({
        action: 'USER_ROLE_REMOVED',
        roleCode: 'PAYROLL_ADMIN',
      }),
    }));
  });

  it('fulfills service account revoke decisions by disabling the account and revoking active credentials', async () => {
    const itemId = new Uuid('00000000-0000-0000-0000-000000000073');
    const activeCredentialId = '00000000-0000-0000-0000-000000000074';
    const repo = repository({
      listServiceAccountCredentials: vi.fn(async () => [
        credential({ id: activeCredentialId, service_account_id: serviceAccountId.value, status: 'ACTIVE' }),
        credential({ id: '00000000-0000-0000-0000-000000000075', service_account_id: serviceAccountId.value, status: 'REVOKED' }),
      ]),
      updateAccessReviewItem: vi.fn(async () => reviewItem('REVOKE', {
        id: itemId.value,
        subject_user_id: null,
        service_account_id: serviceAccountId.value,
        service_account_code: 'PAYROLL_EXPORT_BOT',
      })),
    });
    const service = new AccessGovernanceService(repo as never) as unknown as {
      updateAccessReviewItem: AccessGovernanceService['updateAccessReviewItem'];
    };

    await service.updateAccessReviewItem(tenantId, itemId, { decision: 'REVOKE' }, actorId);

    expect(repo.updateServiceAccount).toHaveBeenCalledWith(tenantId, serviceAccountId, { status: 'DISABLED' });
    expect(repo.updateServiceAccountCredential).toHaveBeenCalledWith(
      tenantId,
      serviceAccountId,
      new Uuid(activeCredentialId),
      expect.objectContaining({
        status: 'REVOKED',
        revoked_reason: 'Access review revoke decision fulfilled',
      }),
    );
    expect(repo.updateServiceAccountCredential).toHaveBeenCalledTimes(1);
    expect(repo.createAccessReviewWorkflowEvent).toHaveBeenCalledWith(tenantId, expect.objectContaining({
      payload: expect.objectContaining({
        action: 'SERVICE_ACCOUNT_DISABLED',
        credentialIdsRevoked: [activeCredentialId],
      }),
    }));
  });

  it('remediates SoD violations by removing the selected role and recording the external workflow boundary', async () => {
    const repo = repository();
    const auditLedger = { write: vi.fn(async () => undefined) };
    const outbox = { schedule: vi.fn(async () => undefined) };
    const service = new AccessGovernanceService(repo as never, auditLedger, outbox) as unknown as {
      remediateSodViolation: (
        tenant: Uuid,
        dto: Record<string, unknown>,
        actor?: Uuid,
      ) => Promise<Record<string, unknown>>;
    };

    const result = await service.remediateSodViolation(tenantId, {
      ruleId: sodRuleId.value,
      subjectUserId: '00000000-0000-0000-0000-000000000080',
      violatingRoleId: '00000000-0000-0000-0000-000000000090',
      conflictingRoleId: '00000000-0000-0000-0000-000000000091',
      action: 'REMOVE_VIOLATING_ROLE',
      evidence: { caseId: 'SOD-100' },
    }, actorId);

    expect(repo.removeUserRole).toHaveBeenCalledWith(
      tenantId,
      new Uuid('00000000-0000-0000-0000-000000000080'),
      new Uuid('00000000-0000-0000-0000-000000000090'),
    );
    expect(result).toEqual(expect.objectContaining({
      action: 'REMOVE_VIOLATING_ROLE',
      removedRoleId: '00000000-0000-0000-0000-000000000090',
      retainedRoleId: '00000000-0000-0000-0000-000000000091',
      externalWorkflowBoundary: 'RECORDED_FOR_GRC_OR_TICKETING_HANDOFF',
    }));
    expect(auditLedger.write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'SodViolationRemediated',
      resourceType: 'SodRule',
      payload: expect.objectContaining({
        action: 'REMOVE_VIOLATING_ROLE',
        caseId: 'SOD-100',
      }),
    }));
    expect(outbox.schedule).toHaveBeenCalled();
  });
});

describe('AccessGovernanceService runtime authorization sync (HCM-P0-2)', () => {
  const userId = new Uuid('00000000-0000-0000-0000-000000000080');
  const roleId = new Uuid('00000000-0000-0000-0000-000000000090');

  function usersRepository() {
    return { setRolesAndPermissions: vi.fn(async () => undefined) };
  }

  it('resyncs the affected user\'s roles/permissions after a role is assigned', async () => {
    const repo = repository({
      computeEffectiveUserAccess: vi.fn(async () => ({ roles: ['PAYROLL_ADMIN'], permissions: ['PAYROLL_READ', 'PAYROLL_APPROVE'] })),
    });
    const users = usersRepository();
    const service = new AccessGovernanceService(repo as never, undefined, undefined, users) as unknown as {
      assignUserRole: AccessGovernanceService['assignUserRole'];
    };

    await service.assignUserRole(tenantId, { userId: userId.value, roleId: roleId.value }, actorId);

    expect(repo.computeEffectiveUserAccess).toHaveBeenCalledWith(tenantId, userId);
    expect(users.setRolesAndPermissions).toHaveBeenCalledWith(userId.value, ['PAYROLL_ADMIN'], ['PAYROLL_READ', 'PAYROLL_APPROVE']);
  });

  it('resyncs the affected user\'s roles/permissions after a role is removed', async () => {
    const repo = repository({
      computeEffectiveUserAccess: vi.fn(async () => ({ roles: [], permissions: [] })),
    });
    const users = usersRepository();
    const service = new AccessGovernanceService(repo as never, undefined, undefined, users) as unknown as {
      removeUserRole: AccessGovernanceService['removeUserRole'];
    };

    await service.removeUserRole(tenantId, userId, roleId);

    expect(repo.computeEffectiveUserAccess).toHaveBeenCalledWith(tenantId, userId);
    expect(users.setRolesAndPermissions).toHaveBeenCalledWith(userId.value, [], []);
  });

  it('fans out a resync to every user holding a role when its permission set is replaced', async () => {
    const otherUserId = '00000000-0000-0000-0000-000000000081';
    const repo = repository({
      listUserIdsForRole: vi.fn(async () => [userId.value, otherUserId]),
      computeEffectiveUserAccess: vi.fn(async () => ({ roles: ['PAYROLL_ADMIN'], permissions: ['PAYROLL_READ'] })),
    });
    const users = usersRepository();
    const service = new AccessGovernanceService(repo as never, undefined, undefined, users) as unknown as {
      replaceRolePermissions: AccessGovernanceService['replaceRolePermissions'];
    };

    await service.replaceRolePermissions(tenantId, roleId, ['00000000-0000-0000-0000-0000000000a1']);

    expect(repo.listUserIdsForRole).toHaveBeenCalledWith(tenantId, roleId);
    expect(users.setRolesAndPermissions).toHaveBeenCalledTimes(2);
    expect(users.setRolesAndPermissions).toHaveBeenCalledWith(userId.value, ['PAYROLL_ADMIN'], ['PAYROLL_READ']);
    expect(users.setRolesAndPermissions).toHaveBeenCalledWith(otherUserId, ['PAYROLL_ADMIN'], ['PAYROLL_READ']);
  });

  it('resyncs the subject user after SoD remediation removes a role', async () => {
    const repo = repository({
      computeEffectiveUserAccess: vi.fn(async () => ({ roles: ['PAYROLL_APPROVER'], permissions: ['PAYROLL_APPROVE'] })),
    });
    const users = usersRepository();
    const service = new AccessGovernanceService(repo as never, undefined, undefined, users) as unknown as {
      remediateSodViolation: (
        tenant: Uuid,
        dto: Record<string, unknown>,
        actor?: Uuid,
      ) => Promise<Record<string, unknown>>;
    };

    await service.remediateSodViolation(tenantId, {
      ruleId: sodRuleId.value,
      subjectUserId: userId.value,
      violatingRoleId: roleId.value,
      conflictingRoleId: '00000000-0000-0000-0000-000000000091',
      action: 'REMOVE_VIOLATING_ROLE',
    }, actorId);

    expect(users.setRolesAndPermissions).toHaveBeenCalledWith(userId.value, ['PAYROLL_APPROVER'], ['PAYROLL_APPROVE']);
  });

  it('resyncs the subject user when an access review revoke decision removes a role', async () => {
    const itemId = new Uuid('00000000-0000-0000-0000-000000000070');
    const repo = repository({
      updateAccessReviewItem: vi.fn(async () => reviewItem('REVOKE', {
        id: itemId.value,
        subject_user_id: userId.value,
        role_id: roleId.value,
        role_code: 'PAYROLL_ADMIN',
      })),
      computeEffectiveUserAccess: vi.fn(async () => ({ roles: [], permissions: [] })),
    });
    const users = usersRepository();
    const service = new AccessGovernanceService(repo as never, undefined, undefined, users) as unknown as {
      updateAccessReviewItem: AccessGovernanceService['updateAccessReviewItem'];
    };

    await service.updateAccessReviewItem(tenantId, itemId, { decision: 'REVOKE' }, actorId);

    expect(users.setRolesAndPermissions).toHaveBeenCalledWith(userId.value, [], []);
  });

  it('does not attempt a resync when no UsersRepository is wired (backward-compatible no-op)', async () => {
    const repo = repository({
      computeEffectiveUserAccess: vi.fn(async () => ({ roles: ['PAYROLL_ADMIN'], permissions: [] })),
    });
    const service = new AccessGovernanceService(repo as never) as unknown as {
      assignUserRole: AccessGovernanceService['assignUserRole'];
    };

    await expect(service.assignUserRole(tenantId, { userId: userId.value, roleId: roleId.value }, actorId))
      .resolves.not.toThrow();
    expect(repo.computeEffectiveUserAccess).not.toHaveBeenCalled();
  });
});
