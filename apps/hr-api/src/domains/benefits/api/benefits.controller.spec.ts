import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { BenefitsController } from './benefits.controller.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const enrollmentId = new Uuid('00000000-0000-0000-0000-000000000003');
const workerId = new Uuid('00000000-0000-0000-0000-000000000004');
const lifeEventId = new Uuid('00000000-0000-0000-0000-000000000005');
const programId = new Uuid('00000000-0000-0000-0000-000000000006');
const accountId = new Uuid('00000000-0000-0000-0000-000000000007');
const runId = new Uuid('00000000-0000-0000-0000-000000000008');

function request(): Request {
  return {
    tenantId: tenantId.value,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['BENEFITS_ADMIN'],
      permissions: ['benefits:write'],
      mfaAuthenticated: true,
    },
  } as unknown as Request;
}

function makeController() {
  const commandBus = { execute: vi.fn(async () => ({ success: true })) };
  const enrollmentRepo = {
    findById: vi.fn(async () => ({
      id: enrollmentId,
      workerId,
      status: 'SUBMITTED',
      aggregateVersion: 2,
    })),
    findByWorker: vi.fn(async () => []),
    findByProgram: vi.fn(async () => []),
  };
  const lifeEventRepo = {
    findById: vi.fn(async () => ({
      id: lifeEventId,
      workerId,
      status: 'RECORDED',
      aggregateVersion: 1,
    })),
    findByWorker: vi.fn(async () => []),
  };
  const programRepo = {
    findById: vi.fn(async () => ({ id: programId, status: 'DRAFT', aggregateVersion: 1 })),
    findByTenant: vi.fn(async () => []),
  };
  const spendingAccountRepo = {
    findById: vi.fn(async () => ({ id: accountId, workerId, status: 'ACTIVE', aggregateVersion: 1 })),
    findByWorker: vi.fn(async () => []),
  };
  const reconciliationRunRepo = {
    findById: vi.fn(async () => ({ id: runId, status: 'IN_PROGRESS', aggregateVersion: 1 })),
    findByCarrier: vi.fn(async () => []),
  };
  const controller = new BenefitsController(
    commandBus as never,
    programRepo as never,
    enrollmentRepo as never,
    lifeEventRepo as never,
    spendingAccountRepo as never,
    reconciliationRunRepo as never,
  );
  return { controller, commandBus, enrollmentRepo, lifeEventRepo, programRepo, spendingAccountRepo, reconciliationRunRepo };
}

describe('BenefitsController lifecycle commands', () => {
  it('builds an approve enrollment command against the canonical benefits enrollment aggregate', async () => {
    const { controller, commandBus, enrollmentRepo } = makeController();

    await controller.approveEnrollment(enrollmentId.value, { approvedBy: actorId.value }, request());

    expect(enrollmentRepo.findById).toHaveBeenCalledWith(enrollmentId);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'ApproveBenefitsEnrollment',
      aggregateType: 'BenefitsEnrollment',
      aggregateId: enrollmentId,
      subjectWorkerId: workerId,
      payload: {
        enrollmentId,
        approvedBy: actorId,
      },
    }));
  });

  it('builds a process life-event command with worker context for notification targeting', async () => {
    const { controller, commandBus, lifeEventRepo } = makeController();

    await controller.processLifeEvent(lifeEventId.value, { processedBy: actorId.value }, request());

    expect(lifeEventRepo.findById).toHaveBeenCalledWith(lifeEventId);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'ProcessBenefitsLifeEvent',
      aggregateType: 'BenefitsLifeEvent',
      aggregateId: lifeEventId,
      subjectWorkerId: workerId,
      payload: {
        lifeEventId,
        processedBy: actorId,
      },
    }));
  });

  it('builds an activate program command against the canonical benefits program aggregate', async () => {
    const { controller, commandBus, programRepo } = makeController();

    await controller.activateProgram(programId.value, {}, request());

    expect(programRepo.findById).toHaveBeenCalledWith(programId);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'ActivateBenefitsProgram',
      aggregateType: 'BenefitsProgram',
      aggregateId: programId,
      payload: { programId },
    }));
  });

  it('builds a close program command carrying an optional reason', async () => {
    const { controller, commandBus, programRepo } = makeController();

    await controller.closeProgram(programId.value, { reason: 'plan discontinued' }, request());

    expect(programRepo.findById).toHaveBeenCalledWith(programId);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CloseBenefitsProgram',
      aggregateType: 'BenefitsProgram',
      aggregateId: programId,
      payload: { programId, reason: 'plan discontinued' },
    }));
  });

  it('builds a record spending account usage command with worker context', async () => {
    const { controller, commandBus, spendingAccountRepo } = makeController();

    await controller.recordSpendingAccountUsage(accountId.value, { amount: 120 }, request());

    expect(spendingAccountRepo.findById).toHaveBeenCalledWith(accountId);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'RecordSpendingAccountUsage',
      aggregateType: 'SpendingAccount',
      aggregateId: accountId,
      subjectWorkerId: workerId,
      payload: { accountId, amount: 120 },
    }));
  });

  it('builds a close spending account command with worker context', async () => {
    const { controller, commandBus, spendingAccountRepo } = makeController();

    await controller.closeSpendingAccount(accountId.value, {}, request());

    expect(spendingAccountRepo.findById).toHaveBeenCalledWith(accountId);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CloseSpendingAccount',
      aggregateType: 'SpendingAccount',
      aggregateId: accountId,
      subjectWorkerId: workerId,
      payload: { accountId },
    }));
  });

  it('builds a detect carrier reconciliation variance command', async () => {
    const { controller, commandBus, reconciliationRunRepo } = makeController();

    await controller.detectReconciliationVariance(runId.value, { varianceAmount: 500 }, request());

    expect(reconciliationRunRepo.findById).toHaveBeenCalledWith(runId);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'DetectCarrierReconciliationVariance',
      aggregateType: 'CarrierReconciliationRun',
      aggregateId: runId,
      payload: { runId, varianceAmount: 500 },
    }));
  });
});
