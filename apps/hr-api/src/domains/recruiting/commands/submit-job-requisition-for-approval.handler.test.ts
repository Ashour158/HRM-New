import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SubmitJobRequisitionForApprovalHandler } from './submit-job-requisition-for-approval.handler.js';
import type { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { JobRequisition } from '../aggregates/job-requisition.aggregate.js';

describe('SubmitJobRequisitionForApprovalHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const positionId = new Uuid('00000000-0000-0000-0000-000000000002');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000003');
  const recruiterId = new Uuid('00000000-0000-0000-0000-000000000004');

  const requisitionRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as JobRequisitionRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['ApproveJobRequisition']),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new SubmitJobRequisitionForApprovalHandler(requisitionRepo, fsm, eventPublisher);

  function draftRequisition(): JobRequisition {
    return JobRequisition.create(
      {
        id: requisitionId,
        tenantId,
        requisitionNumber: 'REQ-0001',
        positionId,
        title: 'Software Engineer',
      },
      Uuid.generate(),
    );
  }

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'SubmitJobRequisitionForApproval',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: recruiterId,
        roles: ['RECRUITER'],
        permissions: ['REQUISITION_SUBMIT'],
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

  it('submits a DRAFT job requisition for approval', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(draftRequisition());

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('PENDING_APPROVAL');
    expect(requisitionRepo.save).toHaveBeenCalled();
    expect(eventPublisher.publishUncommitted).toHaveBeenCalled();
    expect(result.eventsEmitted).toEqual(['JobRequisitionSubmitted']);
  });

  it('rejects when the job requisition cannot be found', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Job requisition not found');
    expect(requisitionRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the job requisition is not in DRAFT state', async () => {
    const requisition = draftRequisition();
    requisition.submitForApproval(Uuid.generate());
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisition);

    await expect(handler.handle(command())).rejects.toThrow(
      'Requisition can only be submitted from DRAFT state',
    );
    expect(requisitionRepo.save).not.toHaveBeenCalled();
  });
});
