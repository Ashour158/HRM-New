import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OpenJobRequisitionHandler } from './open-job-requisition.handler.js';
import { JobRequisition } from '../aggregates/job-requisition.aggregate.js';
import type { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('OpenJobRequisitionHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000102');
  const positionId = new Uuid('00000000-0000-0000-0000-000000000202');

  function requisitionInState(status: JobRequisition['status']): JobRequisition {
    return JobRequisition.rehydrate({
      id: requisitionId,
      tenantId,
      requisitionNumber: 'REQ-002',
      positionId,
      title: 'Staff Engineer',
      status,
      aggregateVersion: 4,
    });
  }

  const requisitionRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as JobRequisitionRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['FillJobRequisition', 'CloseJobRequisition']),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new OpenJobRequisitionHandler(requisitionRepo, fsm, eventPublisher);

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'OpenJobRequisition',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: Uuid.generate(),
        roles: ['RECRUITER'],
        permissions: ['*'],
        mfaAuthenticated: true,
      },
      aggregateType: 'JobRequisition',
      aggregateId: requisitionId,
      expectedState: 'PUBLISHED',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { requisitionId },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions a PUBLISHED requisition to OPEN, unlocking SubmitCandidateApplication', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisitionInState('PUBLISHED'));

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('OPEN');
    const saved = vi.mocked(requisitionRepo.save).mock.calls[0][0] as JobRequisition;
    expect(saved.status).toBe('OPEN');
    expect(result.eventsEmitted).toEqual(['JobRequisitionOpened']);
  });

  it('rejects the transition when the requisition is not PUBLISHED', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisitionInState('APPROVED'));

    await expect(handler.handle(command())).rejects.toThrow(
      'Requisition can only be opened from PUBLISHED state',
    );
    expect(requisitionRepo.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the requisition does not exist', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Job requisition not found');
  });
});
