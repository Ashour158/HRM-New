import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SubmitPolicyDocumentForApprovalHandler } from './submit-policy-document-for-approval.handler.js';
import { RejectPolicyDocumentHandler } from './reject-policy-document.handler.js';
import { ArchivePolicyDocumentHandler } from './archive-policy-document.handler.js';
import type { PolicyDocumentRepository } from '../repositories/policy-document.repository.js';
import { PolicyDocument, type PolicyDocumentStatus } from '../aggregates/policy-document.aggregate.js';
import { ComplianceEventsPublisher } from '../events/compliance-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('PolicyDocument lifecycle handlers (HCM-P0-18)', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const documentId = new Uuid('550e8400-e29b-41d4-a716-446655440001');

  const repo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as PolicyDocumentRepository;

  // Constructs a fresh instance at the given status with no accumulated
  // domainEvents, mirroring how repo.findById() hydrates a new object per
  // load in production (unlike calling multiple transition methods on one
  // in-memory instance, which would accumulate every prior event).
  function documentAtState(status: PolicyDocumentStatus): PolicyDocument {
    return new PolicyDocument({
      id: documentId,
      tenantId,
      title: 'Code of Conduct',
      documentType: 'POLICY',
      documentVersion: '2026.1',
      content: {},
      status,
    });
  }

  function command(commandName: string): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: Uuid.generate(),
        roles: ['COMPLIANCE_ADMIN'],
        permissions: ['COMPLIANCE_WRITE'],
        mfaAuthenticated: true,
      },
      aggregateType: 'PolicyDocument',
      aggregateId: documentId,
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { documentId: documentId.value },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SubmitPolicyDocumentForApprovalHandler transitions DRAFT to PENDING_APPROVAL and emits PolicyDocumentSubmitted', async () => {
    vi.mocked(repo.findById).mockResolvedValue(documentAtState('DRAFT'));
    const handler = new SubmitPolicyDocumentForApprovalHandler(repo, new ComplianceEventsPublisher());

    const result = await handler.handle(command('SubmitPolicyDocumentForApproval'));

    expect(result.newState).toBe('PENDING_APPROVAL');
    expect(result.eventsEmitted).toEqual(['PolicyDocumentSubmitted']);
    const saved = vi.mocked(repo.save).mock.calls[0][0];
    expect(saved.status).toBe('PENDING_APPROVAL');
  });

  it('RejectPolicyDocumentHandler transitions PENDING_APPROVAL to REJECTED and emits PolicyDocumentRejected', async () => {
    vi.mocked(repo.findById).mockResolvedValue(documentAtState('PENDING_APPROVAL'));
    const handler = new RejectPolicyDocumentHandler(repo, new ComplianceEventsPublisher());

    const result = await handler.handle(command('RejectPolicyDocument'));

    expect(result.newState).toBe('REJECTED');
    expect(result.eventsEmitted).toEqual(['PolicyDocumentRejected']);
  });

  it('ArchivePolicyDocumentHandler transitions PUBLISHED to ARCHIVED and emits PolicyDocumentArchived', async () => {
    vi.mocked(repo.findById).mockResolvedValue(documentAtState('PUBLISHED'));
    const handler = new ArchivePolicyDocumentHandler(repo, new ComplianceEventsPublisher());

    const result = await handler.handle(command('ArchivePolicyDocument'));

    expect(result.newState).toBe('ARCHIVED');
    expect(result.eventsEmitted).toEqual(['PolicyDocumentArchived']);
  });

  it('rejects submitting a document that is not in DRAFT state', async () => {
    vi.mocked(repo.findById).mockResolvedValue(documentAtState('PENDING_APPROVAL'));
    const handler = new SubmitPolicyDocumentForApprovalHandler(repo, new ComplianceEventsPublisher());

    await expect(handler.handle(command('SubmitPolicyDocumentForApproval'))).rejects.toThrow(
      'Cannot submit for approval from state PENDING_APPROVAL',
    );
  });
});
