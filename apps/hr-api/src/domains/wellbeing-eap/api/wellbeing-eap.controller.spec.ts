import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { WellbeingEapController } from './wellbeing-eap.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { EapReferralRepository } from '../repositories/eap-referral.repository.js';
import type { WellnessProgramRepository } from '../repositories/wellness-program.repository.js';
import type { MentalHealthCaseRepository } from '../repositories/mental-health-case.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const workerId = '00000000-0000-0000-0000-000000000100';
const providerId = '00000000-0000-0000-0000-000000000200';
const mentalHealthCaseId = '00000000-0000-0000-0000-000000000400';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['WELLBEING_EAP_WRITE', 'WELLBEING_EAP_READ'],
    email: 'hr.admin@example.com',
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

function makeController() {
  const commandBus = { execute: vi.fn(async () => ({ success: true })) } as unknown as CommandBus;
  const eapReferralRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as EapReferralRepository;
  const wellnessProgramRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as WellnessProgramRepository;
  const mentalHealthCaseRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as MentalHealthCaseRepository;

  const controller = new WellbeingEapController(
    commandBus,
    eapReferralRepo,
    wellnessProgramRepo,
    mentalHealthCaseRepo,
  );

  return { controller, commandBus, wellnessProgramRepo, mentalHealthCaseRepo };
}

describe('WellbeingEapController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates wellness programs through authenticated command envelopes', async () => {
    const { controller, commandBus } = makeController();
    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const endDate = new Date('2026-09-30T00:00:00.000Z');

    await controller.createProgram({
      name: 'Burnout prevention cohort',
      type: 'WELLNESS',
      startDate,
      endDate,
      description: 'Quarterly wellbeing support program',
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateWellnessProgram',
      aggregateType: 'WellnessProgram',
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({ actorId: new Uuid(actorId) }),
      payload: expect.objectContaining({
        name: 'Burnout prevention cohort',
        type: 'WELLNESS',
        startDate,
        endDate,
      }),
    }));
  });

  it('creates EAP referrals with worker-scoped support details', async () => {
    const { controller, commandBus } = makeController();
    const scheduledDate = new Date('2026-07-15T10:00:00.000Z');

    await controller.createReferral({
      workerId,
      reason: 'Employee assistance request',
      scheduledDate,
      providerId,
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateEapReferral',
      aggregateType: 'EapReferral',
      tenantId: new Uuid(tenantId),
      payload: expect.objectContaining({
        workerId,
        reason: 'Employee assistance request',
        scheduledDate,
        providerId,
      }),
    }));
  });

  it('opens and assigns mental health cases with aggregate state guards', async () => {
    const { controller, commandBus, mentalHealthCaseRepo } = makeController();
    (mentalHealthCaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(mentalHealthCaseId),
      workerId: new Uuid(workerId),
      status: 'OPEN',
      aggregateVersion: 2,
    });

    await controller.createMhCase({
      workerId,
      severity: 'HIGH',
      providerId,
    }, request());
    await controller.assignMhCase(mentalHealthCaseId, { providerId }, request());

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateMentalHealthCase',
      aggregateType: 'MentalHealthCase',
      payload: expect.objectContaining({
        workerId,
        severity: 'HIGH',
        providerId,
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'AssignToMentalHealthCase',
      aggregateType: 'MentalHealthCase',
      aggregateId: new Uuid(mentalHealthCaseId),
      expectedState: 'OPEN',
      expectedVersion: 2,
      payload: {
        mentalHealthCaseId: new Uuid(mentalHealthCaseId),
        providerId: new Uuid(providerId),
      },
    }));
  });
});
