import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OpenJobRequisitionHandler } from './open-job-requisition.handler.js';
import type { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { JobRequisition } from '../aggregates/job-requisition.aggregate.js';

describe('OpenJobRequisitionHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const positionId = new Uuid('00000000-0000-0000-0000-000000000002');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000003');
  const recruiterId = new Uuid('00000000-0000-0000-0000-000000000004');

  const requisitionRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as JobRequisitionRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['FillJobRequisition']),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new OpenJobRequisitionHandler(requisitionRepo, fsm, eventPublisher);

  function publishedRequisition(): JobRequisition {
    const requisition = JobRequisition.create(
      {
        id: requisitionId,
        tenantId,
        requisitionNumber: 'REQ-0001',
        positionId,
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
        actorId: recruiterId,
        roles: ['RECRUITER'],
        permissions: ['REQUISITION_OPEN'],
        mfaAuthenticated: true,
      },
      aggregateType: 'JobRequisition',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { requisitionId },
      metadata: { requestHash: 'hash', clientType: 'RECRUITER' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens a PUBLISHED job requisition', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(publishedRequisition());

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('OPEN');
    expect(requisitionRepo.save).toHaveBeenCalled();
    expect(eventPublisher.publishUncommitted).toHaveBeenCalled();
    expect(result.eventsEmitted).toEqual(['JobRequisitionOpened']);
  });

  it('rejects when the job requisition cannot be found', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Job requisition not found');
    expect(requisitionRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the job requisition is not in PUBLISHED state', async () => {
    const requisition = JobRequisition.create(
      {
        id: requisitionId,
        tenantId,
        requisitionNumber: 'REQ-0001',
        positionId,
        title: 'Software Engineer',
      },
      Uuid.generate(),
    );
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisition);

    await expect(handler.handle(command())).rejects.toThrow(
      'Requisition can only be opened from PUBLISHED state',
    );
    expect(requisitionRepo.save).not.toHaveBeenCalled();
  });
});
