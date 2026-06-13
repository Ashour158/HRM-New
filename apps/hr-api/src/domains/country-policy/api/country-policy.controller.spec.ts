import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { CountryPolicyController } from './country-policy.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const packId = '00000000-0000-0000-0000-000000000300';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['COUNTRY_POLICY_ADMIN'],
    permissions: ['COUNTRY_POLICY_WRITE', 'COUNTRY_POLICY_READ'],
    email: 'country.policy@example.com',
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
  const policyPackRepo = { findById: vi.fn(), findByCountryCode: vi.fn(), findAll: vi.fn() };
  const validationRunRepo = { findByPolicyPackId: vi.fn() };
  const impactSimRepo = { findByPolicyPackId: vi.fn() };
  const controller = new CountryPolicyController(
    commandBus as unknown as CommandBus,
    policyPackRepo as never,
    validationRunRepo as never,
    impactSimRepo as never,
  );

  return { controller, commandBus, policyPackRepo };
}

describe('CountryPolicyController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uploads, approves, and reads country policy packs with aggregate guards', async () => {
    const { controller, commandBus, policyPackRepo } = buildController();
    const persistedPack = {
      id: new Uuid(packId),
      tenantId: new Uuid(tenantId),
      countryCode: 'EG',
      version: '2026.1',
      status: 'VALIDATED',
      aggregateVersion: 4,
    };
    policyPackRepo.findById.mockResolvedValue(persistedPack);

    await controller.uploadCountryPolicyPack({
      packId,
      countryCode: 'EG',
      version: '2026.1',
      effectiveFrom: new Date('2026-01-01'),
      sections: { payroll: { tax: 'configured' } },
      uploadedBy: actorId,
    }, request());
    await controller.approveCountryPolicyPack({ packId, approvedBy: actorId }, request());
    await expect(controller.getPolicyPack(packId, request())).resolves.toBe(persistedPack);

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'UploadCountryPolicyPack',
      aggregateType: 'CountryPolicyPack',
      payload: expect.objectContaining({ packId, countryCode: 'EG', version: '2026.1' }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'ApproveCountryPolicyPack',
      aggregateType: 'CountryPolicyPack',
      aggregateId: new Uuid(packId),
      expectedState: 'VALIDATED',
      expectedVersion: 4,
      payload: { packId, approvedBy: actorId },
    }));
    expect(policyPackRepo.findById).toHaveBeenCalledWith(new Uuid(packId));
  });
});
