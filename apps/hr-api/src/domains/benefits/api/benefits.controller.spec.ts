import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { BenefitsController } from './benefits.controller.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const enrollmentId = new Uuid('00000000-0000-0000-0000-000000000003');
const workerId = new Uuid('00000000-0000-0000-0000-000000000004');
const lifeEventId = new Uuid('00000000-0000-0000-0000-000000000005');

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
  const controller = new BenefitsController(
    commandBus as never,
    {} as never,
    enrollmentRepo as never,
    lifeEventRepo as never,
    {} as never,
    {} as never,
  );
  return { controller, commandBus, enrollmentRepo, lifeEventRepo };
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
});
