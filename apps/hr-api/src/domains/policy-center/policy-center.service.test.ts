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
const reviewerActor = { actorId: '00000000-0000-0000-0000-000000000011', actorName: 'Policy Reviewer' };
const approverActor = { actorId: '00000000-0000-0000-0000-000000000012', actorName: 'Policy Approver' };

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
      pendingBenefitsEnrollments: 0,
      pendingBenefitsLifeEvents: 0,
    })),
    listImpactRecords: vi.fn(async () => ({
      workers: [
        {
          workerId: 'worker-a',
          displayName: 'Amina Hassan',
          employeeNumber: 'E-001',
          managerWorkerId: 'manager-a',
          departmentId: 'dept-a',
          legalEntityId: 'entity-a',
          countryCode: 'EG',
          beforeDecision: 'Uses current leave policy',
          afterDecision: 'Will use Annual leave policy',
          risk: 'SAFE',
        },
      ],
      leaveRequests: [
        {
          recordId: 'leave-a',
          workerId: 'worker-a',
          status: 'SUBMITTED',
          beforeDecision: 'Pending under current policy',
          afterDecision: 'Revalidation required under new policy',
          risk: 'WARNING',
        },
      ],
      attendanceDays: [],
      payrollCycles: [
        {
          recordId: 'payroll-a',
          status: 'OPEN',
          beforeDecision: 'Open cycle has no statutory pack link',
          afterDecision: 'Cycle must be revalidated before close',
          risk: 'BLOCKED',
        },
      ],
      complianceAcknowledgements: [],
      accessGrants: [],
      benefitsEnrollments: [],
      benefitsLifeEvents: [],
    })),
  };
}

function buildService(seed: PolicyRevisionRecord[] = []) {
  const repository = buildRepository(seed);
  const setupState = {
    leavePolicies: [],
    attendancePolicy: { standardDailyMinutes: 480, flexibleHoursEnabled: false, lateGraceMinutes: 10, overtimeAfterMinutes: 480, geofenceEnabled: false },
  } as Record<string, unknown>;
  const hcmSetup = {
    getSetup: vi.fn(async () => setupState),
    updateSetup: vi.fn(async (_tenantId: Uuid, update: unknown) => {
      Object.assign(setupState, update);
      return setupState;
    }),
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

  it('allows an explicit change draft to replace the active policy it was created from', async () => {
    const active = revision({
      id: '00000000-0000-0000-0000-000000000102',
      status: 'APPLIED',
      aggregateVersion: 3,
      scope: {
        tenantId: tenantId.value,
        departmentIds: ['dept-a'],
        effectiveFrom: '2026-06-01',
      },
    });
    const draft = revision({
      draftConfig: {
        ...revision().draftConfig,
        policyReplacement: {
          replacesRevisionId: active.id,
          replacesStatus: active.status,
        },
      },
    });
    const { service } = buildService([draft, active]);

    const validation = await service.validateRevision(tenantId, draft.id, actor);

    expect(validation.valid).toBe(true);
    expect(validation.conflicts).toEqual([]);
  });

  it('archives the replaced active policy when a replacement revision is applied', async () => {
    const active = revision({
      id: '00000000-0000-0000-0000-000000000102',
      status: 'APPLIED',
      aggregateVersion: 3,
    });
    const replacement = revision({
      id: '00000000-0000-0000-0000-000000000103',
      status: 'PUBLISHED',
      draftConfig: {
        ...revision().draftConfig,
        policyReplacement: {
          replacesRevisionId: active.id,
          replacesStatus: active.status,
        },
      },
    });
    const { service, repository } = buildService([active, replacement]);

    await service.applyRevision(tenantId, replacement.id, actor);

    expect(repository.updateRevision).toHaveBeenCalledWith(active.id, expect.objectContaining({
      status: 'ARCHIVED',
      aggregateVersion: 4,
    }));
    expect(repository.updateRevision).toHaveBeenCalledWith(replacement.id, expect.objectContaining({
      status: 'APPLIED',
    }));
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
        runtimePolicyRevisions: [
          expect.objectContaining({
            area: 'LEAVE',
            revisionId: published.id,
            status: 'APPLIED',
            engineName: 'PolicyApplicationEngine',
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

  it('unwraps country and compliance runtime containers when applying policy revisions', async () => {
    const country = revision({
      id: '00000000-0000-0000-0000-000000000102',
      area: 'COUNTRY_POLICY',
      status: 'PUBLISHED',
      draftConfig: {
        countryPolicyRuntime: {
          countryCode: 'EG',
          packVersion: '2026.2',
          blocksPayrollIfStale: true,
        },
      },
    });
    const compliance = revision({
      id: '00000000-0000-0000-0000-000000000103',
      area: 'COMPLIANCE',
      status: 'PUBLISHED',
      draftConfig: {
        compliancePolicyRuntime: {
          policyFamily: 'CODE_OF_CONDUCT',
          acknowledgementDueDays: 14,
          acknowledgementRequired: true,
        },
      },
    });
    const { service, hcmSetup } = buildService([country, compliance]);

    await service.applyRevision(tenantId, country.id, actor);
    await service.applyRevision(tenantId, compliance.id, actor);

    expect(hcmSetup.updateSetup).toHaveBeenNthCalledWith(1, tenantId, expect.objectContaining({
      countryPolicyRuntime: {
        countryCode: 'EG',
        packVersion: '2026.2',
        blocksPayrollIfStale: true,
      },
      runtimePolicyRevisions: [
        expect.objectContaining({
          area: 'COUNTRY_POLICY',
          revisionId: country.id,
          status: 'APPLIED',
        }),
      ],
    }));
    expect(hcmSetup.updateSetup).toHaveBeenNthCalledWith(2, tenantId, expect.objectContaining({
      compliancePolicyRuntime: {
        policyFamily: 'CODE_OF_CONDUCT',
        acknowledgementDueDays: 14,
        acknowledgementRequired: true,
      },
      runtimePolicyRevisions: [
        expect.objectContaining({
          area: 'COMPLIANCE',
          revisionId: compliance.id,
          status: 'APPLIED',
        }),
      ],
    }));
  });

  it('enforces lifecycle transitions before a policy can be published or applied', async () => {
    const draft = revision({ status: 'DRAFT' });
    const { service } = buildService([draft]);

    await expect(service.publishRevision(tenantId, draft.id, actor)).rejects.toThrow('Only approved policy revisions can be published.');
    await expect(service.applyRevision(tenantId, draft.id, actor)).rejects.toThrow('Only published policy revisions can be applied.');
  });

  it('simulates exact impacted records and notification recipients before apply', async () => {
    const draft = revision();
    const { service } = buildService([draft]);

    const simulation = await service.simulateRevision(tenantId, draft.id, actor);

    expect(simulation.impactedRecords.workers).toEqual([
      expect.objectContaining({
        workerId: 'worker-a',
        displayName: 'Amina Hassan',
        beforeDecision: 'Uses current leave policy',
        afterDecision: 'Will use Annual leave policy',
        risk: 'SAFE',
      }),
    ]);
    expect(simulation.impactedRecords.leaveRequests).toEqual([
      expect.objectContaining({
        recordId: 'leave-a',
        risk: 'WARNING',
      }),
    ]);
    expect(simulation.impactedRecords.payrollCycles).toEqual([
      expect.objectContaining({
        recordId: 'payroll-a',
        risk: 'BLOCKED',
      }),
    ]);
    expect(simulation.notificationPreview.recipients).toEqual(expect.arrayContaining([
      expect.objectContaining({
        audience: 'HR_OPERATIONS',
        title: 'LEAVE policy impact detected',
        privacyLevel: 'CONFIDENTIAL',
      }),
      expect.objectContaining({
        audience: 'EMPLOYEE',
        workerId: 'worker-a',
        title: 'Leave policy changed',
      }),
      expect.objectContaining({
        audience: 'MANAGER',
        workerId: 'manager-a',
        title: 'Leave policy changed for your team',
      }),
    ]));
    expect(simulation.riskSummary).toEqual({
      safe: 1,
      warning: 1,
      blocked: 1,
      retroactiveAdjustmentRequired: 0,
    });
  });

  it('returns semantic revision differences using business labels instead of raw JSON', async () => {
    const current = revision({
      id: '00000000-0000-0000-0000-000000000201',
      title: 'Current leave policy',
      draftConfig: {
        leavePolicies: [
          { code: 'ANNUAL', label: 'Annual Leave', annualEntitlement: 21, maxPerRequest: 15 },
        ],
      },
    });
    const proposed = revision({
      id: '00000000-0000-0000-0000-000000000202',
      title: 'Proposed leave policy',
      draftConfig: {
        leavePolicies: [
          { code: 'ANNUAL', label: 'Annual Leave', annualEntitlement: 24, maxPerRequest: 10 },
        ],
      },
    });
    const { service } = buildService([current, proposed]);

    const diff = await service.compareRevisions(tenantId, current.id, proposed.id);

    expect(diff.area).toBe('LEAVE');
    expect(diff.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Annual Leave annual entitlement',
        before: 21,
        after: 24,
        risk: 'WARNING',
      }),
      expect.objectContaining({
        label: 'Annual Leave maximum per request',
        before: 15,
        after: 10,
        risk: 'SAFE',
      }),
    ]));
  });

  it('creates rollback as a governed replacement draft without mutating runtime', async () => {
    const applied = revision({
      id: '00000000-0000-0000-0000-000000000301',
      status: 'APPLIED',
      baselineConfig: {
        leavePolicies: [{ code: 'ANNUAL', label: 'Annual Leave', annualEntitlement: 21 }],
      },
      draftConfig: {
        leavePolicies: [{ code: 'ANNUAL', label: 'Annual Leave', annualEntitlement: 24 }],
      },
    });
    const { service, repository, hcmSetup } = buildService([applied]);

    const rollback = await service.createRollbackDraft(tenantId, applied.id, { reason: 'Incorrect entitlement' }, actor);

    expect(rollback.status).toBe('DRAFT');
    expect(rollback.title).toBe('Rollback: Annual leave policy');
    expect(rollback.draftConfig).toEqual(expect.objectContaining({
      leavePolicies: [{ code: 'ANNUAL', label: 'Annual Leave', annualEntitlement: 21 }],
      policyReplacement: expect.objectContaining({
        kind: 'ROLLBACK',
        replacesRevisionId: applied.id,
        rollbackReason: 'Incorrect entitlement',
      }),
    }));
    expect(repository.createRevision).toHaveBeenCalledWith(expect.objectContaining({
      id: rollback.id,
      status: 'DRAFT',
    }));
    expect(hcmSetup.updateSetup).not.toHaveBeenCalled();
  });

  it('dry-runs imported policy bundles and reports conflicts without creating revisions', async () => {
    const active = revision({ status: 'APPLIED' });
    const { service, repository } = buildService([active]);

    const result = await service.dryRunImport(tenantId, {
      revisions: [
        {
          area: 'LEAVE',
          title: 'Imported annual leave',
          draftConfig: revision().draftConfig,
          scope: {
            tenantId: tenantId.value,
            departmentIds: ['dept-a'],
            effectiveFrom: '2026-06-01',
          },
        },
      ],
    }, actor);

    expect(result.valid).toBe(false);
    expect(result.revisions).toEqual([
      expect.objectContaining({
        title: 'Imported annual leave',
        action: 'CREATE_DRAFT',
        validation: expect.objectContaining({ valid: false }),
      }),
    ]);
    expect(repository.createRevision).not.toHaveBeenCalled();
  });

  it('blocks maker-checker violations for high-risk payroll policy approval', async () => {
    const reviewed = revision({
      area: 'PAYROLL',
      status: 'REVIEWED',
      createdBy: actor.actorId,
      reviewedBy: reviewerActor.actorId,
      draftConfig: {
        payrollCalculationPolicy: {
          taxMode: 'PROGRESSIVE',
          makerCheckerRequired: true,
        },
      },
    });
    const { service } = buildService([reviewed]);

    await expect(service.approveRevision(tenantId, reviewed.id, actor)).rejects.toThrow(
      'Maker-checker policy blocks creator from approving this revision.',
    );
    await expect(service.approveRevision(tenantId, reviewed.id, approverActor)).resolves.toEqual(expect.objectContaining({
      status: 'APPROVED',
      approvedBy: approverActor.actorId,
    }));
  });

  it('requires emergency policy overrides to expire in the future and marks post-review as required', async () => {
    const published = revision({
      status: 'PUBLISHED',
      draftConfig: {
        ...revision().draftConfig,
        policyControls: { requiresHighRiskConfirmation: true },
      },
    });
    const { service, auditLedger } = buildService([published]);

    await expect(service.applyRevision(tenantId, published.id, actor, {
      emergencyOverride: {
        reason: 'Payroll close cannot wait',
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
    })).rejects.toThrow('Emergency policy override expiry must be in the future.');

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await service.applyRevision(tenantId, published.id, actor, {
      emergencyOverride: {
        reason: ' Payroll close cannot wait ',
        expiresAt,
        postReviewRequired: false,
      },
    });

    expect(auditLedger.write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PolicyRevisionApplied',
      payload: expect.objectContaining({
        emergencyOverride: expect.objectContaining({
          reason: 'Payroll close cannot wait',
          expiresAt,
          postReviewRequired: true,
        }),
      }),
    }));
  });

  it('exposes max-depth policy templates for leave, attendance, access, compliance, benefits, and people analytics domains', () => {
    const { service } = buildService();

    const templates = service.getTemplates();

    expect(templates.map((template) => template.code)).toEqual(expect.arrayContaining([
      'LEAVE-ACCRUAL-LEDGER',
      'ATTENDANCE-RULE-LEDGER',
      'ACCESS-GOVERNANCE-LEDGER',
      'COMPLIANCE-RULE-LEDGER',
      'BENEFITS-ELIGIBILITY-LEDGER',
      'GLOBAL-HR-WORK-AUTHORIZATION',
      'DEI-PAY-EQUITY-GOVERNANCE',
      'ENGAGEMENT-SURVEY-RECOGNITION',
    ]));
    expect(templates.find((template) => template.area === 'BENEFITS')).toEqual(expect.objectContaining({
      area: 'BENEFITS',
      title: expect.stringContaining('Benefits'),
    }));
  });

  it('returns domain-specific simulation sections for governed non-payroll policy ledgers', async () => {
    const benefitsDraft = revision({
      area: 'BENEFITS',
      title: 'Benefits eligibility policy',
      draftConfig: {
        benefitsPolicyRuntime: {
          eligibilityRules: [{
            code: 'MEDICAL_FULL_TIME',
            label: 'Medical plan full-time eligibility',
            active: true,
            logicLedger: {
              code: 'FULL_TIME_WAITING_PERIOD',
              source: 'BENEFITS_LEDGER',
              condition: 'EMPLOYEE_TYPE_IN_SCOPE',
              outcome: 'ALLOW_ENROLLMENT',
              waitingPeriodDays: 30,
              employeeContributionPercent: 20,
              employerContributionPercent: 80,
              payrollDeductionCode: 'MEDICAL_EMPLOYEE_SHARE',
            },
          }],
        },
      },
    });
    const { service } = buildService([benefitsDraft]);

    const simulation = await service.simulateRevision(tenantId, benefitsDraft.id, actor);

    expect(simulation.benefitsPolicySimulation).toEqual(expect.objectContaining({
      ruleCodes: ['MEDICAL_FULL_TIME'],
      payrollBridgeCodes: ['MEDICAL_EMPLOYEE_SHARE'],
      enrollmentWindows: expect.arrayContaining([expect.objectContaining({
        ruleCode: 'MEDICAL_FULL_TIME',
        waitingPeriodDays: 30,
      })]),
    }));
    expect(simulation.compliancePolicySimulation).toBeUndefined();
  });

  it('simulates benefits policy rule ledgers that define window days in outcomes', async () => {
    const benefitsDraft = revision({
      area: 'BENEFITS',
      title: 'Benefits enrollment windows',
      draftConfig: {
        benefitsPolicyRuntime: {
          enrollmentWindowRules: [{
            code: 'OPEN_ENROLLMENT_WAIT',
            label: 'Open enrollment waiting period',
            active: true,
            conditions: [{ field: 'employeeType', operator: 'IN', value: ['FULL_TIME'] }],
            outcomes: [{ action: 'ALLOW', value: { windowDays: 45 } }],
          }],
        },
      },
    });
    const { service } = buildService([benefitsDraft]);

    const simulation = await service.simulateRevision(tenantId, benefitsDraft.id, actor);

    expect(simulation.benefitsPolicySimulation?.enrollmentWindows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleCode: 'OPEN_ENROLLMENT_WAIT',
        waitingPeriodDays: 45,
      }),
    ]));
  });

  it('rejects malformed benefits policy simulation payloads', async () => {
    const malformedBenefitsDraft = revision({
      area: 'BENEFITS',
      title: 'Malformed benefits policy',
      draftConfig: {
        benefitsPolicyRuntime: {
          eligibilityRules: [{
            code: 'MEDICAL_FULL_TIME',
            label: 'Medical plan full-time eligibility',
            active: true,
            logicLedger: 'not-a-ledger',
          }],
        },
      },
    });
    const { service } = buildService([malformedBenefitsDraft]);

    await expect(service.simulateRevision(tenantId, malformedBenefitsDraft.id, actor)).rejects.toThrow(
      'Benefits policy rule MEDICAL_FULL_TIME must include a logic ledger object.',
    );
  });

  it('persists benefits policy runtime when applying a published benefits revision', async () => {
    const benefitsRevision = revision({
      area: 'BENEFITS',
      title: 'Benefits eligibility policy',
      status: 'PUBLISHED',
      draftConfig: {
        benefitsPolicyRuntime: {
          eligibilityRules: [{
            code: 'MEDICAL_FULL_TIME',
            label: 'Medical plan full-time eligibility',
            active: true,
            logicLedger: {
              code: 'FULL_TIME_WAITING_PERIOD',
              source: 'BENEFITS_LEDGER',
              condition: 'EMPLOYEE_TYPE_IN_SCOPE',
              outcome: 'ALLOW_ENROLLMENT',
              waitingPeriodDays: 30,
              employeeContributionPercent: 20,
              employerContributionPercent: 80,
              payrollDeductionCode: 'MEDICAL_EMPLOYEE_SHARE',
            },
          }],
          payrollBridgeRules: [{
            code: 'MEDICAL_PAYROLL_BRIDGE',
            label: 'Medical payroll bridge',
            active: true,
            logicLedger: {
              code: 'MEDICAL_CONTRIBUTION_SYNC',
              source: 'BENEFITS_LEDGER',
              condition: 'ENROLLMENT_ACTIVE',
              outcome: 'CREATE_PAYROLL_BRIDGE',
              payrollDeductionCode: 'MEDICAL_EMPLOYEE_SHARE',
            },
          }],
        },
      },
    });
    const { service, hcmSetup } = buildService([benefitsRevision]);

    await service.applyRevision(tenantId, benefitsRevision.id, actor);
    const storedSetup = await hcmSetup.getSetup();

    expect(storedSetup).toEqual(expect.objectContaining({
      benefitsPolicyRuntime: expect.objectContaining({
        eligibilityRules: [
          expect.objectContaining({
            code: 'MEDICAL_FULL_TIME',
            logicLedger: expect.objectContaining({
              code: 'FULL_TIME_WAITING_PERIOD',
              payrollDeductionCode: 'MEDICAL_EMPLOYEE_SHARE',
            }),
          }),
        ],
        payrollBridgeRules: [
          expect.objectContaining({
            code: 'MEDICAL_PAYROLL_BRIDGE',
            logicLedger: expect.objectContaining({
              code: 'MEDICAL_CONTRIBUTION_SYNC',
            }),
          }),
        ],
      }),
      runtimePolicyRevisions: [
        expect.objectContaining({
          area: 'BENEFITS',
          revisionId: benefitsRevision.id,
          status: 'APPLIED',
        }),
      ],
    }));
  });

  it('preserves per-component payroll scope when applying a revision-level payroll scope', async () => {
    const payrollRevision = revision({
      area: 'PAYROLL',
      title: 'Scoped payroll deductions',
      status: 'PUBLISHED',
      scope: {
        tenantId: tenantId.value,
        countryCodes: ['EG'],
        legalEntityIds: ['revision-entity'],
        departmentIds: ['revision-dept'],
        effectiveFrom: '2026-06-01',
      },
      draftConfig: {
        deductionPolicies: [{
          code: 'ENTITY_LATE_LEDGER',
          label: 'Entity late penalty',
          active: true,
          type: 'LOGIC_LEDGER',
          scope: {
            legalEntityIds: ['component-entity'],
            departmentIds: ['component-dept'],
          },
          logicLedger: {
            code: 'LATE_MINUTES_HIGH_RISK',
            source: 'ATTENDANCE_LEDGER',
            base: 'ATTENDANCE_LATE_MINUTES',
            method: 'PER_UNIT',
            amount: 50,
          },
        }],
      },
    });
    const { service, hcmSetup } = buildService([payrollRevision]);

    await service.applyRevision(tenantId, payrollRevision.id, actor);
    const storedSetup = await hcmSetup.getSetup();

    expect(storedSetup.deductionPolicies?.[0]).toEqual(expect.objectContaining({
      code: 'ENTITY_LATE_LEDGER',
      scope: expect.objectContaining({
        tenantId: tenantId.value,
        countryCodes: ['EG'],
        legalEntityIds: ['component-entity'],
        departmentIds: ['component-dept'],
        effectiveFrom: '2026-06-01',
      }),
    }));
  });
});
