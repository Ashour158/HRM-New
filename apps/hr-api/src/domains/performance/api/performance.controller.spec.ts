import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { PerformanceController } from './performance.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { PerformanceReviewCycleRepository } from '../repositories/performance-review-cycle.repository.js';
import type { PerformanceReviewRepository } from '../repositories/performance-review.repository.js';
import type { GoalRepository } from '../repositories/goal.repository.js';
import type { CalibrationSessionRepository } from '../repositories/calibration-session.repository.js';
import type { PerformanceImprovementPlanRepository } from '../repositories/performance-improvement-plan.repository.js';
import type { Feedback360CycleRepository } from '../repositories/feedback-360-cycle.repository.js';
import type { Feedback360ResponseRepository } from '../repositories/feedback-360-response.repository.js';
import type { ObjectiveRepository } from '../repositories/objective.repository.js';
import type { KeyResultRepository } from '../repositories/key-result.repository.js';
import type { KpiRepository } from '../repositories/kpi.repository.js';
import type { KpiMeasurementRepository } from '../repositories/kpi-measurement.repository.js';
import type { ReviewTemplateRepository } from '../repositories/review-template.repository.js';
import type { CompetencyRepository } from '../repositories/competency.repository.js';
import type { DevelopmentPlanRepository } from '../repositories/development-plan.repository.js';
import type { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const workerId = '00000000-0000-0000-0000-000000000020';

function actor(overrides: Partial<HrActor> = {}): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['PERFORMANCE_CREATE', 'PERFORMANCE_WRITE', 'PERFORMANCE_READ'],
    email: 'hr.admin@example.com',
    mfaAuthenticated: true,
    ...overrides,
  };
}

function requestWithActor(requestActor?: HrActor): Request {
  return {
    tenantId,
    actor: requestActor,
    headers: {},
  } as unknown as Request;
}

describe('PerformanceController', () => {
  const commandBus = { execute: vi.fn() } as unknown as CommandBus;
  const cycleRepo = { findById: vi.fn(), findByTenant: vi.fn() } as unknown as PerformanceReviewCycleRepository;
  const reviewRepo = { findById: vi.fn(), findByWorker: vi.fn(), findByReviewCycle: vi.fn() } as unknown as PerformanceReviewRepository;
  const goalRepo = { findById: vi.fn(), findByWorker: vi.fn() } as unknown as GoalRepository;
  const calibrationRepo = { findById: vi.fn(), findByReviewCycle: vi.fn() } as unknown as CalibrationSessionRepository;
  const pipRepo = { findById: vi.fn(), findByWorker: vi.fn() } as unknown as PerformanceImprovementPlanRepository;
  const feedback360CycleRepo = { findById: vi.fn(), findByTenant: vi.fn() } as unknown as Feedback360CycleRepository;
  const feedback360ResponseRepo = { findById: vi.fn(), findByCycle: vi.fn(), findByReviewee: vi.fn() } as unknown as Feedback360ResponseRepository;
  const objectiveRepo = { findById: vi.fn(), findByOwner: vi.fn(), findByOrgUnit: vi.fn(), findByReviewCycle: vi.fn() } as unknown as ObjectiveRepository;
  const keyResultRepo = { findById: vi.fn(), findByObjective: vi.fn() } as unknown as KeyResultRepository;
  const kpiRepo = { findById: vi.fn(), findByOrgUnit: vi.fn(), findByDepartment: vi.fn() } as unknown as KpiRepository;
  const kpiMeasurementRepo = { findById: vi.fn(), findByKpi: vi.fn() } as unknown as KpiMeasurementRepository;
  const reviewTemplateRepo = { findById: vi.fn(), findByTenant: vi.fn() } as unknown as ReviewTemplateRepository;
  const competencyRepo = { findById: vi.fn(), findByCategory: vi.fn(), findByTenant: vi.fn() } as unknown as CompetencyRepository;
  const developmentPlanRepo = { findById: vi.fn(), findByWorker: vi.fn() } as unknown as DevelopmentPlanRepository;
  const workerRepo = { findById: vi.fn(), findByEmail: vi.fn() } as unknown as WorkerRepository;

  const controller = new PerformanceController(
    commandBus,
    cycleRepo,
    reviewRepo,
    goalRepo,
    calibrationRepo,
    pipRepo,
    feedback360CycleRepo,
    feedback360ResponseRepo,
    objectiveRepo,
    keyResultRepo,
    kpiRepo,
    kpiMeasurementRepo,
    reviewTemplateRepo,
    competencyRepo,
    developmentPlanRepo,
    workerRepo,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects write requests without an authenticated actor', async () => {
    await expect(controller.createReviewCycle({
      name: 'FY26 Annual',
      cycleYear: 2026,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      reviewType: 'ANNUAL',
    }, requestWithActor())).rejects.toBeInstanceOf(ForbiddenException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('uses the authenticated request actor instead of a synthetic HR admin', async () => {
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    const managerActor = actor({
      actorId: new Uuid('00000000-0000-0000-0000-000000000030'),
      roles: ['MANAGER'],
      permissions: ['PERFORMANCE_CREATE'],
      email: 'manager@example.com',
    });

    await controller.createReviewCycle({
      name: 'FY26 Annual',
      cycleYear: 2026,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      reviewType: 'ANNUAL',
    }, requestWithActor(managerActor));

    const command = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(command.actor).toBe(managerActor);
    expect(command.metadata.clientType).toBe('MANAGER_PORTAL');
  });

  it('adds subject worker scope to worker-targeted performance commands', async () => {
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    await controller.createGoal({
      workerId,
      title: 'Improve customer response time',
      targetValue: 95,
    }, requestWithActor(actor()));

    const command = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(command.subjectWorkerId.value).toBe(workerId);
  });

  it('translates command-bus access denials into HTTP forbidden errors', async () => {
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      errorCode: 'ACCESS_CONTROL_DENIED',
      errorMessage: 'RBAC denied',
    });

    await expect(controller.createReviewCycle({
      name: 'FY26 Annual',
      cycleYear: 2026,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      reviewType: 'ANNUAL',
    }, requestWithActor(actor()))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks employee reads for another worker performance record', async () => {
    (workerRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(workerId),
      email: { value: 'someone.else@example.com' },
      managerId: undefined,
    });

    await expect(controller.getGoalsByWorker(
      workerId,
      requestWithActor(actor({
        roles: ['EMPLOYEE'],
        permissions: ['PERFORMANCE_READ'],
        email: 'employee@example.com',
      })),
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes key result creation to the parent objective owner', async () => {
    (objectiveRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid('00000000-0000-0000-0000-000000000040'),
      ownerId: new Uuid(workerId),
    });
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    await controller.createKeyResult({
      objectiveId: '00000000-0000-0000-0000-000000000040',
      title: 'Reduce cycle time',
      targetValue: 10,
    }, requestWithActor(actor()));

    const command = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(command.subjectWorkerId.value).toBe(workerId);
  });

  it('blocks employee key result creation for another worker objective', async () => {
    (objectiveRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid('00000000-0000-0000-0000-000000000040'),
      ownerId: new Uuid(workerId),
    });
    (workerRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(workerId),
      email: { value: 'someone.else@example.com' },
      managerId: undefined,
    });

    await expect(controller.createKeyResult({
      objectiveId: '00000000-0000-0000-0000-000000000040',
      title: 'Reduce cycle time',
      targetValue: 10,
    }, requestWithActor(actor({
      roles: ['EMPLOYEE'],
      permissions: ['PERFORMANCE_CREATE'],
      email: 'employee@example.com',
    })))).rejects.toBeInstanceOf(ForbiddenException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('blocks employee KPI measurement recording', async () => {
    await expect(controller.recordKpiMeasurement({
      kpiId: '00000000-0000-0000-0000-000000000050',
      period: '2026-05',
      measuredValue: 97,
    }, requestWithActor(actor({
      roles: ['EMPLOYEE'],
      permissions: ['PERFORMANCE_CREATE'],
      email: 'employee@example.com',
    })))).rejects.toBeInstanceOf(ForbiddenException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
