import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RejectJobRequisitionHandler } from './reject-job-requisition.handler.js';
import { JobRequisition } from '../aggregates/job-requisition.aggregate.js';
import type { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('RejectJobRequisitionHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000101');
  const positionId = new Uuid('00000000-0000-0000-0000-000000000201');

  function requisitionInState(status: JobRequisition['status']): JobRequisition {
    return JobRequisition.rehydrate({
      id: requisitionId,
      tenantId,
      requisitionNumber: 'REQ-001',
      positionId,
      title: 'Staff Engineer',
      status,
      aggregateVersion: 3,
    });
  }

  const requisitionRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as JobRequisitionRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => []),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new RejectJobRequisitionHandler(requisitionRepo, fsm, eventPublisher);

  function command(overrides: Record<string, unknown> = {}): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'RejectJobRequisition',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: Uuid.generate(),
        roles: ['HR_ADMIN'],
        permissions: ['*'],
        mfaAuthenticated: true,
      },
      aggregateType: 'JobRequisition',
      aggregateId: requisitionId,
      expectedState: 'PENDING_APPROVAL',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { requisitionId, reason: 'Budget frozen', ...overrides },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions a PENDING_APPROVAL requisition to REJECTED', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisitionInState('PENDING_APPROVAL'));

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('REJECTED');
    expect(requisitionRepo.save).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(requisitionRepo.save).mock.calls[0][0] as JobRequisition;
    expect(saved.status).toBe('REJECTED');
    expect(result.eventsEmitted).toEqual(['JobRequisitionRejected']);
  });

  it('rejects the transition when the requisition is not in PENDING_APPROVAL', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisitionInState('DRAFT'));

    await expect(handler.handle(command())).rejects.toThrow(
      'Requisition can only be rejected from PENDING_APPROVAL state',
    );
    expect(requisitionRepo.save).not.toHaveBeenCalled();
  });

  it('is idempotent when the requisition is already REJECTED (retried command)', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisitionInState('REJECTED'));

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('REJECTED');
    expect(result.eventsEmitted).toEqual([]);
    expect(requisitionRepo.save).not.toHaveBeenCalled();
    expect(eventPublisher.publishUncommitted).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the requisition does not exist', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Job requisition not found');
    expect(requisitionRepo.save).not.toHaveBeenCalled();
  });
});
