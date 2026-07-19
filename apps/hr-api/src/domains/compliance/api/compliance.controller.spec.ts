import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { ComplianceController } from './compliance.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const documentId = '00000000-0000-0000-0000-000000000200';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['COMPLIANCE_ADMIN'],
    permissions: ['COMPLIANCE_WRITE', 'COMPLIANCE_READ'],
    email: 'compliance.admin@example.com',
    mfaAuthenticated: true,
  };
}

function request(): Request {
  return {
    tenantId,
    actor: actor(),
    headers: {},
  } as unknown as Request;
}

function buildController() {
  const commandBus = { execute: vi.fn(async () => ({ success: true })) };
  const policyDocumentRepo = { findById: vi.fn(), findByStatus: vi.fn() };
  const policyAcknowledgementRepo = { findById: vi.fn(), findByWorker: vi.fn() };
  const legalHoldRepo = { findById: vi.fn(), findActive: vi.fn() };
  const statutoryReportRepo = { findById: vi.fn(), findByCountryCode: vi.fn() };
  const controller = new ComplianceController(
    commandBus as unknown as CommandBus,
    policyDocumentRepo as never,
    policyAcknowledgementRepo as never,
    legalHoldRepo as never,
    statutoryReportRepo as never,
  );

  return { controller, commandBus, policyDocumentRepo };
}

describe('ComplianceController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates, approves, and reads policy documents with aggregate guards', async () => {
    const { controller, commandBus, policyDocumentRepo } = buildController();
    const persistedDocument = {
      id: new Uuid(documentId),
      tenantId: new Uuid(tenantId),
      title: 'Code of Conduct',
      documentVersion: '2026.1',
      status: 'PENDING_APPROVAL',
      aggregateVersion: 7,
    };
    policyDocumentRepo.findById.mockResolvedValue(persistedDocument);

    await controller.createPolicyDocument({
      documentId,
      title: 'Code of Conduct',
      documentType: 'POLICY',
      version: '2026.1',
      content: { requiresAcknowledgement: true },
      effectiveFrom: new Date('2026-01-01'),
    }, request());
    await controller.approvePolicyDocument(documentId, request());
    await expect(controller.getPolicyDocument(documentId, request())).resolves.toBe(persistedDocument);

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreatePolicyDocument',
      aggregateType: 'PolicyDocument',
      payload: expect.objectContaining({ documentId, title: 'Code of Conduct' }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'ApprovePolicyDocument',
      aggregateType: 'PolicyDocument',
      aggregateId: new Uuid(documentId),
      expectedState: 'PENDING_APPROVAL',
      expectedVersion: 7,
      payload: { documentId },
    }));
    expect(policyDocumentRepo.findById).toHaveBeenCalledWith(new Uuid(documentId));
  });

  it('submits, rejects, and archives policy documents through commandBus (HCM-P0-18)', async () => {
    const { controller, commandBus, policyDocumentRepo } = buildController();

    policyDocumentRepo.findById.mockResolvedValue({ id: new Uuid(documentId), status: 'DRAFT', aggregateVersion: 0 });
    await controller.submitPolicyDocumentForApproval(documentId, request());
    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'SubmitPolicyDocumentForApproval',
      aggregateType: 'PolicyDocument',
      aggregateId: new Uuid(documentId),
      expectedState: 'DRAFT',
      expectedVersion: 0,
      payload: { documentId },
    }));

    policyDocumentRepo.findById.mockResolvedValue({ id: new Uuid(documentId), status: 'PENDING_APPROVAL', aggregateVersion: 1 });
    await controller.rejectPolicyDocument(documentId, request());
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'RejectPolicyDocument',
      aggregateType: 'PolicyDocument',
      aggregateId: new Uuid(documentId),
      expectedState: 'PENDING_APPROVAL',
      expectedVersion: 1,
      payload: { documentId },
    }));

    policyDocumentRepo.findById.mockResolvedValue({ id: new Uuid(documentId), status: 'PUBLISHED', aggregateVersion: 3 });
    await controller.archivePolicyDocument(documentId, request());
    expect(commandBus.execute).toHaveBeenNthCalledWith(3, expect.objectContaining({
      commandName: 'ArchivePolicyDocument',
      aggregateType: 'PolicyDocument',
      aggregateId: new Uuid(documentId),
      expectedState: 'PUBLISHED',
      expectedVersion: 3,
      payload: { documentId },
    }));
  });
});
