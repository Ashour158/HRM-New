import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { HrAiGovernanceController } from './hr-ai-governance.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { HrAiUseCaseRepository } from '../repositories/hr-ai-use-case.repository.js';
import type { HrAiModelRunRepository } from '../repositories/hr-ai-model-run.repository.js';
import type { HrAiBiasTestRepository } from '../repositories/hr-ai-bias-test.repository.js';
import type { HrAiKillSwitchRepository } from '../repositories/hr-ai-kill-switch.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const useCaseId = '00000000-0000-0000-0000-000000000100';
const modelRunId = '00000000-0000-0000-0000-000000000200';
const biasTestId = '00000000-0000-0000-0000-000000000300';
const killSwitchId = '00000000-0000-0000-0000-000000000400';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['HR_AI_GOVERNANCE_WRITE', 'HR_AI_GOVERNANCE_READ'],
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
  const useCaseRepo = {
    findById: vi.fn(),
    findByStatus: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as HrAiUseCaseRepository;
  const modelRunRepo = {
    findById: vi.fn(),
    findByUseCaseId: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as HrAiModelRunRepository;
  const biasTestRepo = {
    findById: vi.fn(),
    findByUseCaseId: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as HrAiBiasTestRepository;
  const killSwitchRepo = {
    findById: vi.fn(),
    findByUseCaseId: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as HrAiKillSwitchRepository;

  const controller = new HrAiGovernanceController(
    commandBus,
    useCaseRepo,
    modelRunRepo,
    biasTestRepo,
    killSwitchRepo,
  );

  return { controller, commandBus, useCaseRepo, modelRunRepo, biasTestRepo, killSwitchRepo };
}

describe('HrAiGovernanceController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('registers HR AI use cases through authenticated command envelopes', async () => {
    const { controller, commandBus } = makeController();

    await controller.registerHrAiUseCase({
      hrAiUseCaseId: useCaseId,
      useCaseName: 'Attrition risk scoring',
      useCaseType: 'WORKFORCE_ANALYTICS',
      riskClassification: 'HIGH',
      description: 'Predicts retention risk for HR review',
      dataUsage: { domains: ['core_hr', 'performance'] },
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'RegisterHrAiUseCase',
      aggregateType: 'HrAiUseCase',
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({ actorId: new Uuid(actorId) }),
      payload: expect.objectContaining({
        hrAiUseCaseId: useCaseId,
        useCaseName: 'Attrition risk scoring',
        riskClassification: 'HIGH',
      }),
    }));
  });

  it('plans HR AI bias tests for registered use cases', async () => {
    const { controller, commandBus } = makeController();

    await controller.planHrAiBiasTest({
      hrAiBiasTestId: biasTestId,
      useCaseId,
      testType: 'ADVERSE_IMPACT',
      testData: { protectedClass: 'gender' },
      threshold: 0.08,
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'PlanHrAiBiasTest',
      aggregateType: 'HrAiBiasTest',
      payload: expect.objectContaining({
        hrAiBiasTestId: biasTestId,
        useCaseId,
        testType: 'ADVERSE_IMPACT',
        threshold: 0.08,
      }),
    }));
  });

  it('logs HR AI model runs for governed use cases', async () => {
    const { controller, commandBus } = makeController();

    await controller.createHrAiModelRun({
      hrAiModelRunId: modelRunId,
      useCaseId,
      modelVersion: 'attrition-risk-v2.1',
      inputDataSnapshot: { cohort: 'Q3-retention-review' },
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateHrAiModelRun',
      aggregateType: 'HrAiModelRun',
      payload: expect.objectContaining({
        hrAiModelRunId: modelRunId,
        useCaseId,
        modelVersion: 'attrition-risk-v2.1',
      }),
    }));
  });

  it('arms and trips HR AI kill switches with aggregate state guards', async () => {
    const { controller, commandBus, killSwitchRepo } = makeController();
    (killSwitchRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(killSwitchId),
      useCaseId: new Uuid(useCaseId),
      status: 'ARMED',
      aggregateVersion: 5,
    });

    await controller.armHrAiKillSwitch({
      hrAiKillSwitchId: killSwitchId,
      useCaseId,
      triggeredBy: actorId,
      triggerReason: 'Bias threshold breach',
    }, request());
    await controller.triggerHrAiKillSwitch(killSwitchId, request());

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'ArmHrAiKillSwitch',
      aggregateType: 'HrAiKillSwitch',
      payload: expect.objectContaining({
        hrAiKillSwitchId: killSwitchId,
        useCaseId,
        triggeredBy: actorId,
        triggerReason: 'Bias threshold breach',
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'TriggerHrAiKillSwitch',
      aggregateType: 'HrAiKillSwitch',
      aggregateId: new Uuid(killSwitchId),
      expectedState: 'ARMED',
      expectedVersion: 5,
      payload: {
        hrAiKillSwitchId: killSwitchId,
      },
    }));
  });

  it('lists HR AI governance records by the authenticated tenant only', async () => {
    const { controller, useCaseRepo, modelRunRepo, biasTestRepo, killSwitchRepo } = makeController();
    (useCaseRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid(useCaseId) }]);
    (modelRunRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid(modelRunId) }]);
    (biasTestRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (killSwitchRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid(killSwitchId) }]);

    await expect(controller.listHrAiUseCasesByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.listHrAiModelRunsByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.listHrAiBiasTestsByTenant(tenantId, request())).resolves.toEqual([]);
    await expect(controller.listHrAiKillSwitchesByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.listHrAiUseCasesByTenant('00000000-0000-0000-0000-000000000999', request())).rejects.toThrow('Tenant mismatch');
  });
});
