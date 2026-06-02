import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { PolicyCenterService } from './policy-center.service.js';
import type {
  PolicyApplicationRunRecord,
  PolicyCenterRepositoryPort,
  PolicyRevisionRecord,
} from './policy-center.types.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actor = { actorId: 'hr-admin-1', actorName: 'HR Admin' };

function revision(overrides: Partial<PolicyRevisionRecord> = {}): PolicyRevisionRecord {
  return {
    id: 'revision-1',
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
  return {
    service: new PolicyCenterService(repository, hcmSetup, notifications),
    repository,
    hcmSetup,
    notifications,
  };
}

describe('PolicyCenterService', () => {
  it('blocks applying a policy with an overlapping active scope at the same precedence', async () => {
    const draft = revision();
    const active = revision({
      id: 'active-revision',
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
    expect(validation.errors).toContain('Active LEAVE policy active-revision already targets the same scope and effective window.');
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

  it('enforces lifecycle transitions before a policy can be published or applied', async () => {
    const draft = revision({ status: 'DRAFT' });
    const { service } = buildService([draft]);

    await expect(service.publishRevision(tenantId, draft.id, actor)).rejects.toThrow('Only approved policy revisions can be published.');
    await expect(service.applyRevision(tenantId, draft.id, actor)).rejects.toThrow('Only published policy revisions can be applied.');
  });
});
