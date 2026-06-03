import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { AccessGovernanceService } from './access-governance.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const serviceAccountId = new Uuid('00000000-0000-0000-0000-000000000020');
const campaignId = new Uuid('00000000-0000-0000-0000-000000000030');

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
    listSodRules: vi.fn(async () => []),
    findServiceAccount: vi.fn(async () => serviceAccount()),
    findServiceAccountCredential: vi.fn(async () => credential()),
    createServiceAccountCredential: vi.fn(async (_tenant: Uuid, input: Record<string, unknown>) => credential(input)),
    updateServiceAccountCredential: vi.fn(async (_tenant: Uuid, _account: Uuid, _credential: Uuid, input: Record<string, unknown>) => credential(input)),
    updateServiceAccount: vi.fn(async (_tenant: Uuid, _account: Uuid, input: Record<string, unknown>) => serviceAccount(input)),
    findAccessReviewCampaign: vi.fn(async () => campaign()),
    listAccessReviewItemsForCampaign: vi.fn(async () => []),
    updateAccessReviewCampaign: vi.fn(async (_tenant: Uuid, _campaign: Uuid, input: Record<string, unknown>) => campaign(input)),
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
        reviewItem('PENDING'),
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
    expect(escalation.eventType).toBe('ESCALATED');
    expect(escalation.pendingItemCount).toBe(1);
    expect(repo.createAccessReviewWorkflowEvent).toHaveBeenCalledTimes(2);
    expect(repo.updateAccessReviewCampaign).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      expect.objectContaining({ escalation_count: 1 }),
    );
  });
});
