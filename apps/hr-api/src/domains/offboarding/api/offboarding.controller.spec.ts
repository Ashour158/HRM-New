import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { OffboardingPlan } from '../aggregates/offboarding-plan.aggregate.js';
import { OffboardingTask } from '../aggregates/offboarding-task.aggregate.js';
import { OffboardingProgressService } from '../services/offboarding-progress.service.js';
import { OffboardingTemplateService } from '../services/offboarding-template.service.js';
import { OffboardingController } from './offboarding.controller.js';
import { CreateOffboardingPlanDto, CreateOffboardingTaskDto } from './dtos.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const workerId = '00000000-0000-0000-0000-000000000020';
const otherWorkerId = '00000000-0000-0000-0000-000000000021';
const planId = '00000000-0000-0000-0000-000000000030';
const taskId = '00000000-0000-0000-0000-000000000040';
const managerId = '00000000-0000-0000-0000-000000000050';

function employeeRequest(worker = workerId): Request {
  return {
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: new Uuid(worker),
      roles: ['EMPLOYEE'],
      permissions: [],
      mfaAuthenticated: true,
      email: 'employee@example.com',
    },
  } as unknown as Request;
}

function adminRequest(): Request {
  return {
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: new Uuid(actorId),
      roles: ['HR_ADMIN'],
      permissions: ['OFFBOARDING_MANAGE'],
      mfaAuthenticated: true,
      email: 'hr.admin@example.com',
    },
  } as unknown as Request;
}

function plan(overrides: Partial<OffboardingPlan> = {}) {
  return OffboardingPlan.restore({
    id: new Uuid(planId),
    tenantId: new Uuid(tenantId),
    workerId: new Uuid(workerId),
    lastWorkingDay: new Date('2026-08-01T00:00:00.000Z'),
    initiatedBy: new Uuid(actorId),
    reasonCategory: 'RESIGNATION',
    reasonNotes: 'Pursuing another opportunity',
    managerId: new Uuid(managerId),
    status: 'ACTIVE',
    aggregateVersion: 2,
    ...overrides,
  });
}

function task(overrides: Partial<OffboardingTask> = {}) {
  return OffboardingTask.restore({
    id: new Uuid(taskId),
    tenantId: new Uuid(tenantId),
    offboardingPlanId: new Uuid(planId),
    title: 'Return company assets',
    description: 'Laptop, badge, and monitor return',
    ownerGroup: 'FACILITIES',
    category: 'ASSET_RETURN',
    required: true,
    evidenceType: 'ASSET_RETURN_CONFIRMATION',
    evidencePayload: { note: 'Laptop returned to front desk' },
    status: 'PENDING',
    aggregateVersion: 1,
    ...overrides,
  });
}

describe('OffboardingController', () => {
  const commandBus = { execute: vi.fn(async (command) => ({ success: true, data: command.payload })) };
  const planRepo = {
    findByTenant: vi.fn(),
    findById: vi.fn(),
    findByWorker: vi.fn(),
  };
  const taskRepo = {
    findByTenant: vi.fn(),
    findByPlan: vi.fn(),
    findById: vi.fn(),
  };
  const templates = new OffboardingTemplateService();
  const progress = new OffboardingProgressService();
  const controller = new OffboardingController(
    commandBus as never,
    planRepo as never,
    taskRepo as never,
    templates,
    progress,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches zod schemas to offboarding DTOs so API payloads are validated', () => {
    expect(CreateOffboardingPlanDto.zodSchema.safeParse({
      planId,
      workerId,
      lastWorkingDay: '2026-08-01',
      reasonCategory: 'RESIGNATION',
    }).success).toBe(true);
    expect(CreateOffboardingTaskDto.zodSchema.safeParse({
      taskId,
      planId,
      title: 'Return laptop',
      ownerGroup: 'Facilities',
    }).success).toBe(true);
  });

  it('lists all tenant offboarding plans with reason and initiator fields', async () => {
    planRepo.findByTenant.mockResolvedValue([plan()]);

    await expect(controller.listPlans(adminRequest())).resolves.toMatchObject([
      {
        id: planId,
        workerId,
        reasonCategory: 'RESIGNATION',
        initiatedBy: actorId,
        managerId,
      },
    ]);
    expect(planRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
  });

  it('rejects a non-admin from listing offboarding plans', async () => {
    await expect(controller.listPlans(employeeRequest())).rejects.toBeInstanceOf(ForbiddenException);
    expect(planRepo.findByTenant).not.toHaveBeenCalled();
  });

  it('defaults initiatedBy to the acting admin when the request omits it', async () => {
    await controller.createPlan(
      { planId, workerId, lastWorkingDay: new Date('2026-08-01'), reasonCategory: 'RESIGNATION' } as CreateOffboardingPlanDto,
      adminRequest(),
    );

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateOffboardingPlan',
      payload: expect.objectContaining({ initiatedBy: actorId }),
    }));
  });

  it('returns structured task ownership and evidence fields for a plan', async () => {
    taskRepo.findByPlan.mockResolvedValue([task()]);

    await expect(controller.getTasksByPlan(planId, adminRequest())).resolves.toMatchObject([
      {
        id: taskId,
        ownerGroup: 'FACILITIES',
        category: 'ASSET_RETURN',
        evidenceType: 'ASSET_RETURN_CONFIRMATION',
      },
    ]);
  });

  it('applies a reason-based template by dispatching checklist task commands', async () => {
    planRepo.findById.mockResolvedValue(plan());

    const result = await controller.applyTemplate(
      planId,
      { trackCode: 'standard-offboarding' },
      adminRequest(),
    );

    expect(result.createdTaskCount).toBeGreaterThan(5);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateOffboardingTask',
      aggregateType: 'OffboardingTask',
      actor: expect.objectContaining({
        actorId: new Uuid(actorId),
        roles: ['HR_ADMIN'],
      }),
    }));
  });

  it('rejects an employee fetching another worker offboarding plan', async () => {
    planRepo.findByWorker.mockResolvedValue(plan({ workerId: new Uuid(otherWorkerId) }));

    await expect(controller.getPlanByWorker(otherWorkerId, employeeRequest(workerId))).rejects.toBeInstanceOf(ForbiddenException);

    expect(planRepo.findByWorker).not.toHaveBeenCalled();
  });

  it('rejects an employee fetching tasks for another worker offboarding plan', async () => {
    planRepo.findById.mockResolvedValue(plan({ workerId: new Uuid(otherWorkerId) }));
    taskRepo.findByPlan.mockResolvedValue([task()]);

    await expect(controller.getTasksByPlan(planId, employeeRequest(workerId))).rejects.toBeInstanceOf(ForbiddenException);

    expect(taskRepo.findByPlan).not.toHaveBeenCalled();
  });

  it('allows the departing worker to complete their own offboarding task', async () => {
    planRepo.findById.mockResolvedValue(plan({ workerId: new Uuid(workerId) }));
    taskRepo.findById.mockResolvedValue(task({ assignedTo: new Uuid(workerId) }));

    await controller.completeTask(taskId, employeeRequest(workerId));

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CompleteOffboardingTask',
    }));
  });

  it('rejects an employee completing another worker offboarding task', async () => {
    planRepo.findById.mockResolvedValue(plan({ workerId: new Uuid(otherWorkerId) }));
    taskRepo.findById.mockResolvedValue(task({ assignedTo: new Uuid(otherWorkerId) }));

    await expect(controller.completeTask(taskId, employeeRequest(workerId))).rejects.toBeInstanceOf(ForbiddenException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects an employee recording evidence on another worker offboarding task', async () => {
    planRepo.findById.mockResolvedValue(plan({ workerId: new Uuid(otherWorkerId) }));
    taskRepo.findById.mockResolvedValue(task({ assignedTo: new Uuid(otherWorkerId) }));

    await expect(controller.recordTaskEvidence(
      taskId,
      { evidenceType: 'ASSET_RETURN_CONFIRMATION', evidencePayload: { note: 'Returned laptop' } },
      employeeRequest(workerId),
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('summarizes workbench progress and metrics across plans and tasks', async () => {
    planRepo.findByTenant.mockResolvedValue([plan()]);
    taskRepo.findByTenant.mockResolvedValue([task(), task({ id: new Uuid('00000000-0000-0000-0000-000000000041'), status: 'COMPLETED', category: 'FINAL_SETTLEMENT_CONFIRMATION' })]);

    const workbench = await controller.getWorkbench(adminRequest());

    expect(workbench.plans).toHaveLength(1);
    expect(workbench.plans[0].tasks).toHaveLength(2);
    expect(workbench.metrics.activePlans).toBe(1);
  });
});
