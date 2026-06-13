import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { ContingentWorkforceController } from './contingent-workforce.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { ContingentWorkerAssignmentRepository } from '../repositories/contingent-worker-assignment.repository.js';
import type { SowEngagementRepository } from '../repositories/sow-engagement.repository.js';
import type { ContractorRateCardRepository } from '../repositories/contractor-rate-card.repository.js';
import type { MisclassificationAssessmentRepository } from '../repositories/misclassification-assessment.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const workerId = '00000000-0000-0000-0000-000000000100';
const vendorId = '00000000-0000-0000-0000-000000000200';
const projectId = '00000000-0000-0000-0000-000000000300';
const assessmentId = '00000000-0000-0000-0000-000000000400';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['CONTINGENT_WORKFORCE_WRITE', 'CONTINGENT_WORKFORCE_READ'],
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
  const cwaRepo = {
    findById: vi.fn(),
    findByWorker: vi.fn(),
  } as unknown as ContingentWorkerAssignmentRepository;
  const sowRepo = {
    findById: vi.fn(),
  } as unknown as SowEngagementRepository;
  const rateCardRepo = {
    findById: vi.fn(),
  } as unknown as ContractorRateCardRepository;
  const assessmentRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as MisclassificationAssessmentRepository;

  const controller = new ContingentWorkforceController(
    commandBus,
    cwaRepo,
    sowRepo,
    rateCardRepo,
    assessmentRepo,
  );

  return { controller, commandBus, assessmentRepo };
}

describe('ContingentWorkforceController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates SOW engagements through authenticated command envelopes', async () => {
    const { controller, commandBus } = makeController();
    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const endDate = new Date('2026-12-31T00:00:00.000Z');

    await controller.createSow({
      sowNumber: 'SOW-2026-001',
      vendorId,
      projectName: 'Payroll modernization support',
      totalValue: 125000,
      currency: 'USD',
      startDate,
      endDate,
      milestones: ['Discovery', 'Delivery', 'Handover'],
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateSowEngagement',
      aggregateType: 'SowEngagement',
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({ actorId: new Uuid(actorId) }),
      payload: expect.objectContaining({
        sowNumber: 'SOW-2026-001',
        vendorId,
        projectName: 'Payroll modernization support',
        totalValue: 125000,
      }),
    }));
  });

  it('assigns contingent workers to vendor projects', async () => {
    const { controller, commandBus } = makeController();
    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const endDate = new Date('2026-10-31T00:00:00.000Z');

    await controller.createAssignment({
      workerId,
      vendorId,
      projectId,
      startDate,
      endDate,
      rate: 95,
      currency: 'USD',
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateContingentWorkerAssignment',
      aggregateType: 'ContingentWorkerAssignment',
      payload: expect.objectContaining({
        workerId,
        vendorId,
        projectId,
        rate: 95,
        currency: 'USD',
      }),
    }));
  });

  it('sets contractor rate cards for vendor job titles', async () => {
    const { controller, commandBus } = makeController();
    const effectiveFrom = new Date('2026-07-01T00:00:00.000Z');
    const effectiveUntil = new Date('2026-12-31T00:00:00.000Z');

    await controller.createRateCard({
      vendorId,
      jobTitle: 'Senior HRIS Consultant',
      rate: 110,
      currency: 'USD',
      effectiveFrom,
      effectiveUntil,
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateContractorRateCard',
      aggregateType: 'ContractorRateCard',
      payload: expect.objectContaining({
        vendorId,
        jobTitle: 'Senior HRIS Consultant',
        rate: 110,
        effectiveFrom,
        effectiveUntil,
      }),
    }));
  });

  it('runs misclassification assessments with aggregate state guards', async () => {
    const { controller, commandBus, assessmentRepo } = makeController();
    const assessmentDate = new Date('2026-07-05T00:00:00.000Z');
    (assessmentRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(assessmentId),
      workerId: new Uuid(workerId),
      status: 'PENDING',
      aggregateVersion: 4,
    });

    await controller.createAssessment({
      workerId,
      assessmentDate,
      riskScore: 62,
      riskFactors: ['manager_control', 'long_duration'],
    }, request());
    await controller.startAssessment(assessmentId, request());

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateMisclassificationAssessment',
      aggregateType: 'MisclassificationAssessment',
      payload: expect.objectContaining({
        workerId,
        assessmentDate,
        riskScore: 62,
        riskFactors: ['manager_control', 'long_duration'],
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'StartMisclassificationAssessment',
      aggregateType: 'MisclassificationAssessment',
      aggregateId: new Uuid(assessmentId),
      expectedState: 'PENDING',
      expectedVersion: 4,
      payload: {
        misclassificationAssessmentId: new Uuid(assessmentId),
      },
    }));
  });
});
