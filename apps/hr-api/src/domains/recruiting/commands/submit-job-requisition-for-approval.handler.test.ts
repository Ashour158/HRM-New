import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SubmitJobRequisitionForApprovalHandler } from './submit-job-requisition-for-approval.handler.js';
import type { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import { JobRequisition } from '../aggregates/job-requisition.aggregate.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('SubmitJobRequisitionForApprovalHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('550e8400-e29b-41d4-a716-446655440001');

  const requisitionRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as JobRequisitionRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['ApproveJobRequisition']),
  } as unknown as FsmFramework;

  const handler = new SubmitJobRequisitionForApprovalHandler(requisitionRepo, fsm, new RecruitingEventsPublisher());

  function draftRequisition(): JobRequisition {
    return JobRequisition.create(
      {
        id: requisitionId,
        tenantId,
        requisitionNumber: 'REQ-001',
        positionId: Uuid.generate(),
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

  it('transitions a DRAFT requisition to PENDING_APPROVAL and persists it', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(draftRequisition());

    const result = await handler.handle(command());

    expect(result.newState).toBe('PENDING_APPROVAL');
    expect(result.eventsEmitted).toEqual(['JobRequisitionSubmitted']);
    const saved = vi.mocked(requisitionRepo.save).mock.calls[0][0];
    expect(saved.status).toBe('PENDING_APPROVAL');
  });

  it('throws NotFoundException when the requisition does not exist', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Job requisition not found');
    expect(requisitionRepo.save).not.toHaveBeenCalled();
  });

  it('rejects submitting a requisition that is not in DRAFT state', async () => {
    const requisition = draftRequisition();
    requisition.submitForApproval(Uuid.generate());
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisition);

    await expect(handler.handle(command())).rejects.toThrow(
      'Requisition can only be submitted from DRAFT state',
    );
  });
});
