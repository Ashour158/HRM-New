import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { PolicyCenterService } from './policy-center.service.js';
import type {
  PolicyApplicationRunRecord,
  PolicyCenterRepositoryPort,
  PolicyRevisionRecord,
} from './policy-center.types.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actor = { actorId: '00000000-0000-0000-0000-000000000010', actorName: 'HR Admin' };

function revision(overrides: Partial<PolicyRevisionRecord> = {}): PolicyRevisionRecord {
  return {
    id: '00000000-0000-0000-0000-000000000101',
    tenantId: tenantId.value,
    area: 'LEAVE',
    title: 'Annual leave policy',
    status: 'DRAFT',
    baselineConfig: {},
    draftConfig: {
      leavePolicies: [
        {
          code: 'ANNUAL',
          label: 'Annual Leave',
          active: true,
          unit: 'DAYS',
          paid: true,
          deductFromBalance: true,
          requestableByEmployee: true,
          payrollImpact: 'PAID_LEAVE',
          approvalWorkflow: 'MANAGER',
          annualEntitlement: 21,
          maxPerRequest: 15,
          minNoticeDays: 2,
        },
      ],
    },
    scope: {
      tenantId: tenantId.value,
      departmentIds: ['dept-a'],
      effectiveFrom: '2026-06-01',
    },
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    aggregateVersion: 0,
    ...overrides,
  };
}

function buildRepository(seed: PolicyRevisionRecord[]): PolicyCenterRepositoryPort {
  const rows = new Map(seed.map((row) => [row.id, row]));

  return {
    createRevision: vi.fn(async (record) => {
      rows.set(record.id, record);
      return record;
    }),
    updateRevision: vi.fn(async (id, update) => {
      const next = { ...rows.get(id)!, ...update } as PolicyRevisionRecord;
      rows.set(id, next);
      return next;
    }),
    findRevisionById: vi.fn(async (_tenantId, id) => rows.get(id)),
    listRevisions: vi.fn(async () => Array.from(rows.values())),
    listActiveRevisionsByArea: vi.fn(async (_tenantId, area) =>
      Array.from(rows.values()).filter((row) => row.area === area && (row.status === 'PUBLISHED' || row.status === 'APPLIED')),
    ),
    createApplicationRun: vi.fn(async (run) => run as PolicyApplicationRunRecord),
    createImpactResult: vi.fn(async (result) => result),
    createDecisionEvidence: vi.fn(async (evidence) => evidence),
    listDecisionEvidence: vi.fn(async () => [
      {
        id: '00000000-0000-0000-0000-000000000901',
        tenantId: tenantId.value,
        policyRevisionId: '00000000-0000-0000-0000-000000000101',
        serviceArea: 'LEAVE',
        engineName: 'PolicyApplicationEngine',
        engineVersion: '1.0.0',
        scopeMatch: { tenantId: tenantId.value },
        decision: 'APPLIED',
        reason: 'Policy revision was written to runtime.',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ]),
    summarizePolicyCenter: vi.fn(async () => ({ totalRevisions: rows.size, byStatus: {}, byArea: {}, recentRuns: [] })),
    countImpactedWorkers: vi.fn(async () => ({ count: 3, workerIds: ['worker-a', 'worker-b', 'worker-c'] })),
    countPendingDomainRecords: vi.fn(async () => ({
      pendingLeaveRequests: 2,
      openAttendanceDays: 1,
      openPayrollCycles: 1,
      pendingComplianceAcknowledgements: 0,
    })),
  };
}

function buildService(seed: PolicyRevisionRecord[] = []) {
  const repository = buildRepository(seed);
  const hcmSetup = {
    getSetup: vi.fn(async () => ({
      leavePolicies: [],
      attendancePolicy: { standardDailyMinutes: 480, flexibleHoursEnabled: false, lateGraceMinutes: 10, overtimeAfterMinutes: 480, geofenceEnabled: false },
    })),
    updateSetup: vi.fn(async (_tenantId: Uuid, update: unknown) => update),
  };
  const notifications = { createMany: vi.fn(async () => undefined) };
  const auditLedger = { write: vi.fn(async () => undefined) };
  const outbox = { schedule: vi.fn(async () => undefined) };
  return {
    service: new (PolicyCenterService as never)(repository, hcmSetup, notifications, auditLedger, outbox) as PolicyCenterService,
    repository,
    hcmSetup,
    notifications,
    auditLedger,
    outbox,
  };
}

describe('PolicyCenterService', () => {
  it('writes blocking audit and outbox evidence when a revision is drafted', async () => {
    const { service, repository, auditLedger, outbox } = buildService();

    const created = await service.createRevision(tenantId, {
      area: 'LEAVE',
      title: 'Annual leave policy',
      draftConfig: revision().draftConfig,
      scope: { departmentIds: ['dept-a'] },
    }, actor);

    expect(auditLedger.write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PolicyRevisionDrafted',
      resourceType: 'PolicyRevision',
      resourceId: expect.objectContaining({ value: created.id }),
      payload: expect.objectContaining({
        policyRevisionId: created.id,
        fromStatus: 'INITIAL',
        toStatus: 'DRAFT',
      }),
    }));
    expect(outbox.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PolicyRevisionDrafted' }),
      tenantId,
      expect.any(Uuid),
    );
    expect(vi.mocked(auditLedger.write).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.createRevision).mock.invocationCallOrder[0],
    );
  });

  it('blocks applying a policy with an overlapping active scope at the same precedence', async () => {
    const draft = revision();
    const active = revision({
      id: '00000000-0000-0000-0000-000000000102',
      status: 'APPLIED',
      scope: {
        tenantId: tenantId.value,
        departmentIds: ['dept-a'],
        effectiveFrom: '2026-06-01',
      },
    });
    const { service } = buildService([draft, active]);

    const validation = await service.validateRevision(tenantId, draft.id, actor);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Active LEAVE policy 00000000-0000-0000-0000-000000000102 already targets the same scope and effective window.');
  });

  it('writes blocking audit and outbox evidence when an editable revision is updated', async () => {
    const draft = revision({ status: 'DRAFT' });
    const { service, auditLedger, outbox } = buildService([draft]);

    await service.updateRevision(tenantId, draft.id, { title: 'Updated leave policy' }, actor);

    expect(auditLedger.write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PolicyRevisionUpdated',
      resourceId: expect.objectContaining({ value: draft.id }),
      payload: expect.objectContaining({
        policyRevisionId: draft.id,
        fromStatus: 'DRAFT',
        toStatus: 'DRAFT',
        changedFields: ['title'],
      }),
    }));
    expect(outbox.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PolicyRevisionUpdated' }),
      tenantId,
      expect.any(Uuid),
    );
  });

  it('only applies published revisions and writes their runtime policy snapshot into HCM setup', async () => {
    const published = revision({ status: 'PUBLISHED' });
    const { service, hcmSetup, repository } = buildService([published]);

    await service.applyRevision(tenantId, published.id, actor);

    expect(hcmSetup.updateSetup).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        leavePolicies: [
          expect.objectContaining({
            code: 'ANNUAL',
            departmentCodes: ['dept-a'],
            effectiveFrom: '2026-06-01',
          }),
        ],
      }),
    );
    expect(repository.createApplicationRun).toHaveBeenCalledWith(expect.objectContaining({
      revisionId: published.id,
      status: 'APPLIED',
      impactedEmployees: 3,
    }));
    expect(repository.createDecisionEvidence).toHaveBeenCalledWith(expect.objectContaining({
      engineName: 'PolicyApplicationEngine',
      decision: 'APPLIED',
      policyRevisionId: published.id,
    }));
  });

  it('notifies HR operations and impacted workers when a revision is applied', async () => {
    const published = revision({ status: 'PUBLISHED' });
    const { service, notifications } = buildService([published]);

    await service.applyRevision(tenantId, published.id, actor);

    expect(notifications.createMany).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        audience: 'HR_OPERATIONS',
        sourceEventName: 'PolicyRevisionApplied',
        relatedAggregateId: published.id,
      }),
      expect.objectContaining({
        audience: 'EMPLOYEE',
        recipientWorkerId: 'worker-a',
        title: 'Leave policy changed',
      }),
    ]));
  });

  it('returns recent policy decision evidence for admin audit screens', async () => {
    const { service } = buildService();

    await expect(service.listDecisionEvidence(tenantId, 5)).resolves.toEqual([
      expect.objectContaining({
        policyRevisionId: '00000000-0000-0000-0000-000000000101',
        engineName: 'PolicyApplicationEngine',
        decision: 'APPLIED',
      }),
    ]);
  });

  it('writes blocking audit and outbox evidence when a revision is submitted for review', async () => {
    const draft = revision({ status: 'DRAFT' });
    const { service, auditLedger, outbox } = buildService([draft]);

    await service.submitForReview(tenantId, draft.id, actor);

    expect(auditLedger.write).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      action: 'PolicyRevisionSubmittedForReview',
      resourceType: 'PolicyRevision',
      resourceId: expect.objectContaining({ value: draft.id }),
      payload: expect.objectContaining({
        policyRevisionId: draft.id,
        fromStatus: 'DRAFT',
        toStatus: 'IN_REVIEW',
      }),
    }));
    expect(outbox.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'PolicyRevisionSubmittedForReview',
        aggregateType: 'PolicyRevision',
        aggregateId: expect.objectContaining({ value: draft.id }),
        payload: expect.objectContaining({
          policyRevisionId: draft.id,
          fromStatus: 'DRAFT',
          toStatus: 'IN_REVIEW',
        }),
      }),
      tenantId,
      expect.any(Uuid),
    );
  });

  it('writes blocking audit and outbox evidence for review and approval transitions', async () => {
    const inReview = revision({ status: 'IN_REVIEW' });
    const reviewed = revision({ id: '00000000-0000-0000-0000-000000000103', status: 'REVIEWED' });
    const { service, auditLedger, outbox } = buildService([inReview, reviewed]);

    await service.markReviewed(tenantId, inReview.id, actor);
    await service.approveRevision(tenantId, reviewed.id, actor);

    expect(auditLedger.write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PolicyRevisionReviewed',
      resourceId: expect.objectContaining({ value: inReview.id }),
      payload: expect.objectContaining({
        fromStatus: 'IN_REVIEW',
        toStatus: 'REVIEWED',
      }),
    }));
    expect(auditLedger.write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PolicyRevisionApproved',
      resourceId: expect.objectContaining({ value: reviewed.id }),
      payload: expect.objectContaining({
        fromStatus: 'REVIEWED',
        toStatus: 'APPROVED',
      }),
    }));
    expect(outbox.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PolicyRevisionReviewed' }),
      tenantId,
      expect.any(Uuid),
    );
    expect(outbox.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PolicyRevisionApproved' }),
      tenantId,
      expect.any(Uuid),
    );
  });

  it('writes publish governance before mutating approved revisions', async () => {
    const approved = revision({ status: 'APPROVED' });
    const { service, repository, auditLedger, outbox } = buildService([approved]);

    await service.publishRevision(tenantId, approved.id, actor);

    expect(auditLedger.write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PolicyRevisionPublished',
      resourceId: expect.objectContaining({ value: approved.id }),
      payload: expect.objectContaining({
        fromStatus: 'APPROVED',
        toStatus: 'PUBLISHED',
      }),
    }));
    expect(outbox.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PolicyRevisionPublished' }),
      tenantId,
      expect.any(Uuid),
    );
    expect(vi.mocked(auditLedger.write).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.updateRevision).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(outbox.schedule).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.updateRevision).mock.invocationCallOrder[0],
    );
  });

  it('blocks publish when outbox evidence cannot be scheduled', async () => {
    const approved = revision({ status: 'APPROVED' });
    const { service, repository, outbox } = buildService([approved]);
    vi.mocked(outbox.schedule).mockRejectedValueOnce(new Error('outbox down'));

    await expect(service.publishRevision(tenantId, approved.id, actor)).rejects.toThrow('outbox down');

    expect(repository.updateRevision).not.toHaveBeenCalled();
  });

  it('writes apply governance before mutating runtime setup', async () => {
    const published = revision({ status: 'PUBLISHED' });
    const { service, hcmSetup, auditLedger, outbox } = buildService([published]);

    await service.applyRevision(tenantId, published.id, actor);

    expect(auditLedger.write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PolicyRevisionApplied',
      resourceId: expect.objectContaining({ value: published.id }),
      payload: expect.objectContaining({
        fromStatus: 'PUBLISHED',
        toStatus: 'APPLIED',
      }),
    }));
    expect(outbox.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PolicyRevisionApplied' }),
      tenantId,
      expect.any(Uuid),
    );
    expect(vi.mocked(auditLedger.write).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(hcmSetup.updateSetup).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(outbox.schedule).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(hcmSetup.updateSetup).mock.invocationCallOrder[0],
    );
  });

  it('enforces lifecycle transitions before a policy can be published or applied', async () => {
    const draft = revision({ status: 'DRAFT' });
    const { service } = buildService([draft]);

    await expect(service.publishRevision(tenantId, draft.id, actor)).rejects.toThrow('Only approved policy revisions can be published.');
    await expect(service.applyRevision(tenantId, draft.id, actor)).rejects.toThrow('Only published policy revisions can be applied.');
  });
});
