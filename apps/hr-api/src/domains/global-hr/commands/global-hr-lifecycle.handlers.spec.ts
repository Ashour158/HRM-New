import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { WorkAuthorizationCase } from '../aggregates/work-authorization-case.aggregate.js';
import { InternationalAssignment } from '../aggregates/international-assignment.aggregate.js';
import { ApproveWorkAuthorizationCaseHandler } from './approve-work-authorization-case.handler.js';
import { ActivateInternationalAssignmentHandler } from './activate-international-assignment.handler.js';
import type { WorkAuthorizationCaseRepository } from '../repositories/work-authorization-case.repository.js';
import type { InternationalAssignmentRepository } from '../repositories/international-assignment.repository.js';
import type { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const workerId = new Uuid('00000000-0000-0000-0000-000000000020');
const caseId = new Uuid('00000000-0000-0000-0000-000000000030');
const assignmentId = new Uuid('00000000-0000-0000-0000-000000000040');

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId,
    roles: ['HR_ADMIN', 'GLOBAL_HR_ADMIN'],
    permissions: ['GLOBAL_HR_WRITE'],
    email: 'global.hr@example.com',
    mfaAuthenticated: true,
  };
}

function envelope<T>(commandName: string, aggregateType: string, payload: T): HrCommandEnvelope<T> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: actor(),
    aggregateType,
    aggregateId: aggregateType === 'InternationalAssignment' ? assignmentId : caseId,
    expectedState: undefined,
    expectedVersion: undefined,
    idempotencyKey: `${commandName}-${Date.now()}`,
    correlationId: Uuid.generate(),
    reason: 'spec',
    payload,
    metadata: { clientType: 'HR_ADMIN' },
  };
}

function fsm() {
  return {
    getAllowedActionsFromState: vi.fn(() => ['Close']),
  } as unknown as FsmFramework;
}

describe('Global HR lifecycle command handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('approves work authorization cases and emits explainable next actions', async () => {
    const authCase = new WorkAuthorizationCase({
      id: caseId,
      tenantId,
      workerId,
      authorizationType: 'WORK_PERMIT',
      issuingCountry: 'AE',
      status: 'UNDER_REVIEW',
      aggregateVersion: 1,
    });
    const repo = {
      findById: vi.fn(async () => authCase),
      save: vi.fn(),
    } as unknown as WorkAuthorizationCaseRepository;
    const publisher = { publishUncommitted: vi.fn(async () => undefined) } as unknown as GlobalHrEventsPublisher;
    const handler = new ApproveWorkAuthorizationCaseHandler(repo, fsm(), publisher);

    const result = await handler.handle(envelope('ApproveWorkAuthorizationCase', 'WorkAuthorizationCase', {
      workAuthorizationCaseId: caseId,
      validFrom: new Date('2026-07-01T00:00:00.000Z'),
      validUntil: new Date('2027-07-01T00:00:00.000Z'),
      documentNumber: 'WP-2026-001',
    }));

    expect(result.success).toBe(true);
    expect(result.newState).toBe('APPROVED');
    expect(result.eventsEmitted).toContain('WorkAuthorizationCaseApproved');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: 'APPROVED',
      documentNumber: 'WP-2026-001',
    }));
    expect(publisher.publishUncommitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: caseId }),
      tenantId,
      expect.anything(),
    );
  });

  it('activates international assignments and records the lifecycle event', async () => {
    const assignment = new InternationalAssignment({
      id: assignmentId,
      tenantId,
      workerId,
      homeCountry: 'EG',
      hostCountry: 'AE',
      legalEntityId: new Uuid('00000000-0000-0000-0000-000000000050'),
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2027-08-01T00:00:00.000Z'),
      assignmentReason: 'Regional expansion',
      status: 'APPROVED',
      aggregateVersion: 2,
    });
    const repo = {
      findById: vi.fn(async () => assignment),
      save: vi.fn(),
    } as unknown as InternationalAssignmentRepository;
    const publisher = { publishUncommitted: vi.fn(async () => undefined) } as unknown as GlobalHrEventsPublisher;
    const handler = new ActivateInternationalAssignmentHandler(repo, fsm(), publisher);

    const result = await handler.handle(envelope('ActivateInternationalAssignment', 'InternationalAssignment', {
      internationalAssignmentId: assignmentId,
    }));

    expect(result.success).toBe(true);
    expect(result.newState).toBe('ACTIVE');
    expect(result.eventsEmitted).toContain('InternationalAssignmentActivated');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' }));
    expect(publisher.publishUncommitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: assignmentId }),
      tenantId,
      expect.anything(),
    );
  });
});
