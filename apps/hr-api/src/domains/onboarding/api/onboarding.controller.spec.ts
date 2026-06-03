import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { OnboardingPlan } from '../aggregates/onboarding-plan.aggregate.js';
import { OnboardingTask } from '../aggregates/onboarding-task.aggregate.js';
import { OnboardingReadinessService } from '../services/onboarding-readiness.service.js';
import { OnboardingTemplateService } from '../services/onboarding-template.service.js';
import { OnboardingController } from './onboarding.controller.js';
import { CreateOnboardingPlanDto, CreateOnboardingTaskDto } from './dtos.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const workerId = '00000000-0000-0000-0000-000000000020';
const otherWorkerId = '00000000-0000-0000-0000-000000000021';
const planId = '00000000-0000-0000-0000-000000000030';
const taskId = '00000000-0000-0000-0000-000000000040';

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

function plan(overrides: Partial<OnboardingPlan> = {}) {
  return OnboardingPlan.restore({
    id: new Uuid(planId),
    tenantId: new Uuid(tenantId),
    workerId: new Uuid(workerId),
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    assignedBuddyId: new Uuid('00000000-0000-0000-0000-000000000050'),
    mentorId: new Uuid('00000000-0000-0000-0000-000000000060'),
    roleTrack: 'STANDARD_EMPLOYEE',
    preboardingPortalStatus: 'INVITED',
    welcomeMessage: 'Welcome aboard',
    probationReviewDate: new Date('2026-09-29T00:00:00.000Z'),
    probationStatus: 'PENDING_REVIEW',
    status: 'IN_PROGRESS',
    aggregateVersion: 2,
    ...overrides,
  });
}

function task(overrides: Partial<OnboardingTask> = {}) {
  return OnboardingTask.restore({
    id: new Uuid(taskId),
    tenantId: new Uuid(tenantId),
    onboardingPlanId: new Uuid(planId),
    title: 'Provision email and HRM access',
    description: 'Create email and HRM account',
    ownerGroup: 'IT',
    category: 'IT_PROVISIONING',
    required: true,
    evidenceType: 'PROVISIONING_TICKET',
    evidencePayload: { ticket: 'IT-42' },
    provisioningTarget: 'IAM',
    status: 'PENDING',
    aggregateVersion: 1,
    ...overrides,
  });
}

describe('OnboardingController', () => {
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
  const templates = new OnboardingTemplateService();
  const readiness = new OnboardingReadinessService();
  const controller = new OnboardingController(
    commandBus as never,
    planRepo as never,
    taskRepo as never,
    templates,
    readiness,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches zod schemas to onboarding DTOs so API payloads are validated', () => {
    expect(CreateOnboardingPlanDto.zodSchema.safeParse({
      planId,
      workerId,
      startDate: '2026-07-01',
      roleTrack: 'STANDARD_EMPLOYEE',
    }).success).toBe(true);
    expect(CreateOnboardingTaskDto.zodSchema.safeParse({
      taskId,
      planId,
      title: 'Upload identity documents',
      ownerGroup: 'Finance',
    }).success).toBe(true);
  });

  it('lists all tenant onboarding plans with preboarding and probation fields', async () => {
    planRepo.findByTenant.mockResolvedValue([plan()]);

    await expect(controller.listPlans(tenantId)).resolves.toMatchObject([
      {
        id: planId,
        workerId,
        roleTrack: 'STANDARD_EMPLOYEE',
        preboardingPortalStatus: 'INVITED',
        probationStatus: 'PENDING_REVIEW',
      },
    ]);
    expect(planRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
  });

  it('returns structured task ownership and evidence fields for a plan', async () => {
    taskRepo.findByPlan.mockResolvedValue([task()]);

    await expect(controller.getTasksByPlan(planId)).resolves.toMatchObject([
      {
        id: taskId,
        ownerGroup: 'IT',
        category: 'IT_PROVISIONING',
        evidenceType: 'PROVISIONING_TICKET',
        provisioningTarget: 'IAM',
      },
    ]);
  });

  it('applies a role-based template by dispatching checklist task commands', async () => {
    planRepo.findById.mockResolvedValue(plan());

    const result = await controller.applyTemplate(
      planId,
      { trackCode: 'standard-employee' },
      tenantId,
      actorId,
      'HR_ADMIN',
    );

    expect(result.createdTaskCount).toBeGreaterThan(5);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateOnboardingTask',
      aggregateType: 'OnboardingTask',
    }));
  });

  it('rejects an employee fetching another worker onboarding plan', async () => {
    planRepo.findByWorker.mockResolvedValue(plan({ workerId: new Uuid(otherWorkerId) }));

    await expect(controller.getPlanByWorker(otherWorkerId, employeeRequest(workerId))).rejects.toBeInstanceOf(ForbiddenException);

    expect(planRepo.findByWorker).not.toHaveBeenCalled();
  });

  it('rejects an employee fetching tasks for another worker onboarding plan', async () => {
    planRepo.findById.mockResolvedValue(plan({ workerId: new Uuid(otherWorkerId) }));
    taskRepo.findByPlan.mockResolvedValue([task()]);

    await expect(controller.getTasksByPlan(planId, employeeRequest(workerId))).rejects.toBeInstanceOf(ForbiddenException);

    expect(taskRepo.findByPlan).not.toHaveBeenCalled();
  });

  it('rejects an employee completing another worker onboarding task', async () => {
    planRepo.findById.mockResolvedValue(plan({ workerId: new Uuid(otherWorkerId) }));
    taskRepo.findById.mockResolvedValue(task({ assignedTo: new Uuid(otherWorkerId) }));

    await expect(controller.completeTask(taskId, tenantId, workerId, 'EMPLOYEE', employeeRequest(workerId))).rejects.toBeInstanceOf(ForbiddenException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects an employee recording evidence on another worker onboarding task', async () => {
    planRepo.findById.mockResolvedValue(plan({ workerId: new Uuid(otherWorkerId) }));
    taskRepo.findById.mockResolvedValue(task({ assignedTo: new Uuid(otherWorkerId) }));

    await expect(controller.recordTaskEvidence(
      taskId,
      { evidenceType: 'DOCUMENT_UPLOAD', evidencePayload: { document: 'id.pdf' } },
      tenantId,
      workerId,
      'EMPLOYEE',
      employeeRequest(workerId),
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
