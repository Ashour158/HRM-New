import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OpenJobRequisitionHandler } from './open-job-requisition.handler.js';
import type { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import { JobRequisition } from '../aggregates/job-requisition.aggregate.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('OpenJobRequisitionHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('550e8400-e29b-41d4-a716-446655440001');

  const requisitionRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as JobRequisitionRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['FillJobRequisition']),
  } as unknown as FsmFramework;

  const handler = new OpenJobRequisitionHandler(requisitionRepo, fsm, new RecruitingEventsPublisher());

  function publishedRequisition(): JobRequisition {
    const requisition = JobRequisition.create(
      {
        id: requisitionId,
        tenantId,
        requisitionNumber: 'REQ-001',
        positionId: Uuid.generate(),
        title: 'Software Engineer',
      },
      Uuid.generate(),
    );
    requisition.submitForApproval(Uuid.generate());
    requisition.approve(Uuid.generate());
    requisition.publish(Uuid.generate());
    return requisition;
  }

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
        permissions: ['REQUISITION_UPDATE'],
        mfaAuthenticated: true,
      },
      aggregateType: 'JobRequisition',
      aggregateId: requisitionId,
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

  it('transitions a PUBLISHED requisition to OPEN and persists it', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(publishedRequisition());

    const result = await handler.handle(command());

    expect(result.newState).toBe('OPEN');
    expect(result.eventsEmitted).toEqual(['JobRequisitionOpened']);
    const saved = vi.mocked(requisitionRepo.save).mock.calls[0][0];
    expect(saved.status).toBe('OPEN');
  });

  it('throws NotFoundException when the requisition does not exist', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Job requisition not found');
    expect(requisitionRepo.save).not.toHaveBeenCalled();
  });

  it('rejects opening a requisition that is not in PUBLISHED state', async () => {
    const requisition = JobRequisition.create(
      {
        id: requisitionId,
        tenantId,
        requisitionNumber: 'REQ-002',
        positionId: Uuid.generate(),
        title: 'Software Engineer',
      },
      Uuid.generate(),
    );
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisition);

    await expect(handler.handle(command())).rejects.toThrow(
      'Requisition can only be opened from PUBLISHED state',
    );
  });
});
