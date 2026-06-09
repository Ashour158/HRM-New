import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AccessGovernanceController } from './access-governance.controller.js';
import type { AccessGovernanceService } from './access-governance.service.js';

function request(roles: string[] = ['HR_ADMIN']): Request {
  return {
    tenantId: '00000000-0000-0000-0000-000000000001',
    actor: {
      actorType: 'USER',
      actorId: new Uuid('00000000-0000-0000-0000-000000000010'),
      roles,
      permissions: [],
    },
  } as unknown as Request;
}

function service(): AccessGovernanceService {
  return {
    getSummary: vi.fn(async () => ({
      roles: [],
      permissions: [],
      rolePermissions: [],
      userRoles: [],
      serviceAccounts: [],
      serviceAccountCredentials: [],
      accessReviewCampaigns: [],
      accessReviewItems: [],
      accessReviewWorkflowEvents: [],
      abacPolicies: [],
      fieldAccessPolicies: [],
      sodRules: [],
    })),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    createPermission: vi.fn(),
    updatePermission: vi.fn(),
    replaceRolePermissions: vi.fn(),
    assignRolePermission: vi.fn(),
    removeRolePermission: vi.fn(),
    assignUserRole: vi.fn(),
    removeUserRole: vi.fn(),
    createServiceAccount: vi.fn(),
    updateServiceAccount: vi.fn(),
    issueServiceAccountCredential: vi.fn(),
    rotateServiceAccountCredential: vi.fn(),
    revokeServiceAccountCredential: vi.fn(),
    createAccessReviewCampaign: vi.fn(),
    updateAccessReviewCampaign: vi.fn(),
    launchAccessReviewCampaign: vi.fn(),
    sendAccessReviewReminders: vi.fn(),
    escalateAccessReviewCampaign: vi.fn(),
    completeAccessReviewCampaign: vi.fn(),
    createAccessReviewItem: vi.fn(),
    updateAccessReviewItem: vi.fn(),
    createAbacPolicy: vi.fn(),
    updateAbacPolicy: vi.fn(),
    createFieldAccessPolicy: vi.fn(),
    updateFieldAccessPolicy: vi.fn(),
    createSodRule: vi.fn(),
    updateSodRule: vi.fn(),
    remediateSodViolation: vi.fn(),
  } as unknown as AccessGovernanceService;
}

describe('AccessGovernanceController', () => {
  it('returns operational access governance summary with identity visibility areas', async () => {
    const fakeService = service();
    const controller = new AccessGovernanceController(fakeService);

    const result = await controller.getSummary(request());

    expect(fakeService.getSummary).toHaveBeenCalledWith(new Uuid('00000000-0000-0000-0000-000000000001'));
    expect(result.serviceAccounts).toEqual([]);
    expect(result.accessReviewCampaigns).toEqual([]);
  });

  it('allows governance admins to create roles', async () => {
    const fakeService = service();
    vi.mocked(fakeService.createRole).mockResolvedValue({
      id: 'role-1',
      code: 'PAYROLL_VIEWER',
      name: 'Payroll Viewer',
      tier: 'TENANT',
      description: null,
      isSystem: false,
      createdAt: '2026-06-03T00:00:00.000Z',
    });
    const controller = new AccessGovernanceController(fakeService);

    const result = await controller.createRole(
      { code: 'PAYROLL_VIEWER', name: 'Payroll Viewer', tier: 'TENANT' },
      request(['PLATFORM_ADMIN']),
    );

    expect(fakeService.createRole).toHaveBeenCalled();
    expect(result.code).toBe('PAYROLL_VIEWER');
  });

  it('allows governance admins to create service accounts', async () => {
    const fakeService = service();
    vi.mocked(fakeService.createServiceAccount).mockResolvedValue({
      id: 'service-account-1',
      code: 'PAYROLL_EXPORT_BOT',
      name: 'Payroll Export Bot',
      ownerWorkerId: null,
      status: 'ACTIVE',
      scopes: ['payroll:export'],
      credentialRotationDays: 90,
      lastRotatedAt: null,
      expiresAt: null,
      createdBy: '00000000-0000-0000-0000-000000000010',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
    });
    const controller = new AccessGovernanceController(fakeService);

    const result = await controller.createServiceAccount(
      { code: 'PAYROLL_EXPORT_BOT', name: 'Payroll Export Bot', scopes: ['payroll:export'] },
      request(['SUPER_ADMIN']),
    );

    expect(fakeService.createServiceAccount).toHaveBeenCalledWith(
      new Uuid('00000000-0000-0000-0000-000000000001'),
      { code: 'PAYROLL_EXPORT_BOT', name: 'Payroll Export Bot', scopes: ['payroll:export'] },
      new Uuid('00000000-0000-0000-0000-000000000010'),
    );
    expect(result.code).toBe('PAYROLL_EXPORT_BOT');
  });

  it('issues service account credentials through a one-time secret route', async () => {
    const fakeService = service();
    vi.mocked(fakeService.issueServiceAccountCredential).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000040',
      serviceAccountId: '00000000-0000-0000-0000-000000000020',
      name: 'Payroll API key',
      secretPrefix: 'hcm_sa_test_1234',
      status: 'ACTIVE',
      scopes: ['payroll:export'],
      issuedAt: '2026-06-03T00:00:00.000Z',
      expiresAt: null,
      lastUsedAt: null,
      rotatedAt: null,
      revokedAt: null,
      revokedReason: null,
      credentialLifecycle: {
        storageMode: 'HASH_ONLY_EXTERNAL_VAULT_READY',
        secretMaterialState: 'ONE_TIME_SECRET_RETURNED',
        externalVaultBoundary: 'PENDING_EXTERNAL_VAULT_INTEGRATION',
        vaultSecretRef: null,
        rotationDueAt: null,
      },
      createdBy: '00000000-0000-0000-0000-000000000010',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      oneTimeSecret: 'hcm_sa_test_123456',
    });
    const controller = new AccessGovernanceController(fakeService);

    const result = await controller.issueServiceAccountCredential(
      '00000000-0000-0000-0000-000000000020',
      { name: 'Payroll API key', scopes: ['payroll:export'] },
      request(['SUPER_ADMIN']),
    );

    expect(fakeService.issueServiceAccountCredential).toHaveBeenCalledWith(
      new Uuid('00000000-0000-0000-0000-000000000001'),
      new Uuid('00000000-0000-0000-0000-000000000020'),
      { name: 'Payroll API key', scopes: ['payroll:export'] },
      new Uuid('00000000-0000-0000-0000-000000000010'),
    );
    expect(result.oneTimeSecret).toMatch(/^hcm_sa_/);
  });

  it('routes access review certification commands through the governance service', async () => {
    const fakeService = service();
    vi.mocked(fakeService.sendAccessReviewReminders).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000060',
      campaignId: '00000000-0000-0000-0000-000000000030',
      eventType: 'REMINDER_SENT',
      actorId: '00000000-0000-0000-0000-000000000010',
      targetRole: 'COMPLIANCE_OFFICER',
      message: 'Please certify',
      pendingItemCount: 2,
      payload: {},
      createdAt: '2026-06-03T00:00:00.000Z',
    });
    const controller = new AccessGovernanceController(fakeService);

    const result = await controller.sendAccessReviewReminders(
      '00000000-0000-0000-0000-000000000030',
      { message: 'Please certify' },
      request(['COMPLIANCE_OFFICER']),
    );

    expect(fakeService.sendAccessReviewReminders).toHaveBeenCalledWith(
      new Uuid('00000000-0000-0000-0000-000000000001'),
      new Uuid('00000000-0000-0000-0000-000000000030'),
      { message: 'Please certify' },
      new Uuid('00000000-0000-0000-0000-000000000010'),
    );
    expect(result.eventType).toBe('REMINDER_SENT');
  });

  it('routes access review item decisions through the governance service', async () => {
    const fakeService = service();
    vi.mocked(fakeService.updateAccessReviewItem).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000099',
      campaignId: '00000000-0000-0000-0000-000000000088',
      subjectUserId: '00000000-0000-0000-0000-000000000011',
      subjectWorkerId: null,
      roleId: null,
      roleCode: null,
      permissionId: null,
      permissionCode: null,
      serviceAccountId: null,
      serviceAccountCode: null,
      decision: 'APPROVED',
      reviewerId: '00000000-0000-0000-0000-000000000010',
      reviewedAt: '2026-06-03T00:00:00.000Z',
      evidence: { decidedFrom: 'test' },
      createdAt: '2026-06-03T00:00:00.000Z',
    });
    const controller = new AccessGovernanceController(fakeService);

    const result = await controller.updateAccessReviewItem(
      '00000000-0000-0000-0000-000000000099',
      { decision: 'APPROVED', evidence: { decidedFrom: 'test' } },
      request(['COMPLIANCE_OFFICER']),
    );

    expect(fakeService.updateAccessReviewItem).toHaveBeenCalledWith(
      new Uuid('00000000-0000-0000-0000-000000000001'),
      new Uuid('00000000-0000-0000-0000-000000000099'),
      { decision: 'APPROVED', evidence: { decidedFrom: 'test' } },
      new Uuid('00000000-0000-0000-0000-000000000010'),
    );
    expect(result.decision).toBe('APPROVED');
  });

  it('routes SoD remediation commands through the governance service', async () => {
    const fakeService = service();
    vi.mocked(fakeService.remediateSodViolation).mockResolvedValue({
      ruleId: '00000000-0000-0000-0000-0000000000a0',
      ruleCode: 'PAYROLL_REQUEST_APPROVE',
      subjectUserId: '00000000-0000-0000-0000-000000000080',
      action: 'REMOVE_CONFLICTING_ROLE',
      removedRoleId: '00000000-0000-0000-0000-000000000091',
      retainedRoleId: '00000000-0000-0000-0000-000000000090',
      evidence: { caseId: 'SOD-101' },
      remediatedBy: '00000000-0000-0000-0000-000000000010',
      remediatedAt: '2026-06-03T00:00:00.000Z',
      externalWorkflowBoundary: 'RECORDED_FOR_GRC_OR_TICKETING_HANDOFF',
    });
    const controller = new AccessGovernanceController(fakeService) as unknown as {
      remediateSodViolation: (ruleId: string, dto: Record<string, unknown>, req: Request) => Promise<Record<string, unknown>>;
    };

    const result = await controller.remediateSodViolation(
      '00000000-0000-0000-0000-0000000000a0',
      {
        subjectUserId: '00000000-0000-0000-0000-000000000080',
        violatingRoleId: '00000000-0000-0000-0000-000000000090',
        conflictingRoleId: '00000000-0000-0000-0000-000000000091',
        action: 'REMOVE_CONFLICTING_ROLE',
        evidence: { caseId: 'SOD-101' },
      },
      request(['COMPLIANCE_OFFICER']),
    );

    expect(fakeService.remediateSodViolation).toHaveBeenCalledWith(
      new Uuid('00000000-0000-0000-0000-000000000001'),
      expect.objectContaining({
        ruleId: '00000000-0000-0000-0000-0000000000a0',
        action: 'REMOVE_CONFLICTING_ROLE',
      }),
      new Uuid('00000000-0000-0000-0000-000000000010'),
    );
    expect(result.externalWorkflowBoundary).toBe('RECORDED_FOR_GRC_OR_TICKETING_HANDOFF');
  });

  it('blocks write operations for non-governance roles', async () => {
    const controller = new AccessGovernanceController(service());

    await expect(
      controller.createRole({ code: 'PAYROLL_VIEWER', name: 'Payroll Viewer', tier: 'TENANT' }, request(['EMPLOYEE'])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
