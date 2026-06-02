import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
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
import type { PerformanceNotificationService } from '../services/performance-notification.service.js';
import type { PerformanceAnalyticsService } from '../services/performance-analytics.service.js';
import type { PerformanceNotificationRepository } from '../repositories/performance-notification.repository.js';

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
  const reviewRepo = { findById: vi.fn(), findByWorker: vi.fn(), findByReviewCycle: vi.fn(), findByManager: vi.fn() } as unknown as PerformanceReviewRepository;
  const goalRepo = { findById: vi.fn(), findByWorker: vi.fn() } as unknown as GoalRepository;
  const calibrationRepo = { findById: vi.fn(), findByReviewCycle: vi.fn() } as unknown as CalibrationSessionRepository;
  const pipRepo = { findById: vi.fn(), findByWorker: vi.fn() } as unknown as PerformanceImprovementPlanRepository;
  const feedback360CycleRepo = { findById: vi.fn(), findByTenant: vi.fn() } as unknown as Feedback360CycleRepository;
  const feedback360ResponseRepo = { findById: vi.fn(), findByCycle: vi.fn(), findByReviewee: vi.fn(), findByReviewer: vi.fn() } as unknown as Feedback360ResponseRepository;
  const objectiveRepo = { findById: vi.fn(), findByOwner: vi.fn(), findByOrgUnit: vi.fn(), findByReviewCycle: vi.fn(), findByParent: vi.fn() } as unknown as ObjectiveRepository;
  const keyResultRepo = { findById: vi.fn(), findByObjective: vi.fn() } as unknown as KeyResultRepository;
  const kpiRepo = { findById: vi.fn(), findByOrgUnit: vi.fn(), findByDepartment: vi.fn() } as unknown as KpiRepository;
  const kpiMeasurementRepo = { findById: vi.fn(), findByKpi: vi.fn() } as unknown as KpiMeasurementRepository;
  const reviewTemplateRepo = { findById: vi.fn(), findByTenant: vi.fn() } as unknown as ReviewTemplateRepository;
  const competencyRepo = { findById: vi.fn(), findByCategory: vi.fn(), findByTenant: vi.fn() } as unknown as CompetencyRepository;
  const developmentPlanRepo = { findById: vi.fn(), findByWorker: vi.fn() } as unknown as DevelopmentPlanRepository;
  const workerRepo = { findById: vi.fn(), findByEmail: vi.fn(), findByManager: vi.fn(), findActive: vi.fn() } as unknown as WorkerRepository;
  const performanceNotificationService = {
    notifyReviewCycleSetup: vi.fn(),
    notifyReviewAssignments: vi.fn(),
    notifyPeerReviewRequest: vi.fn(),
  } as unknown as PerformanceNotificationService;
  const performanceAnalyticsService = { buildCycleAnalytics: vi.fn() } as unknown as PerformanceAnalyticsService;
  const performanceNotificationRepo = { findByWorker: vi.fn(), markRead: vi.fn() } as unknown as PerformanceNotificationRepository;

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
    performanceNotificationService,
    performanceAnalyticsService,
    performanceNotificationRepo,
  );

  beforeEach(() => {
    vi.resetAllMocks();
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

  it('carries template, weighting, and period setup into review cycle creation commands', async () => {
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    const templateId = '00000000-0000-0000-0000-000000000555';
    (reviewTemplateRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(templateId),
      tenantId: new Uuid(tenantId),
      status: 'ACTIVE',
    });

    await controller.createReviewCycle({
      name: 'FY26 Annual',
      cycleYear: 2026,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      reviewType: 'ANNUAL',
      templateId,
      weightings: { self: 20, manager: 50, peer: 30 },
      periods: [
        { name: 'Self review', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
        { name: 'Manager review', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28') },
      ],
    }, requestWithActor(actor()));

    const command = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(command.payload.templateId).toBe(templateId);
    expect(command.payload.weightings).toEqual({ self: 20, manager: 50, peer: 30 });
    expect(command.payload.periods).toHaveLength(2);
  });

  it('notifies active employees after review cycle setup succeeds', async () => {
    const managerWorkerId = new Uuid('00000000-0000-0000-0000-000000000021');
    (cycleRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid('00000000-0000-0000-0000-000000000100'),
      tenantId: new Uuid(tenantId),
      name: 'FY26 Annual Review',
      status: 'DRAFT',
      aggregateVersion: 0,
      periods: [
        { name: 'Self review', startDate: new Date('2026-06-01'), endDate: new Date('2026-06-15') },
        { name: 'Manager review', startDate: new Date('2026-06-16'), endDate: new Date('2026-06-30') },
      ],
    });
    (workerRepo.findActive as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: new Uuid(workerId),
        tenantId: new Uuid(tenantId),
        managerId: managerWorkerId,
        firstName: 'Aly',
        lastName: 'Employee',
      },
    ]);
    (reviewRepo.findByReviewCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (commandBus.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: true,
        data: { performanceReviewId: '00000000-0000-0000-0000-000000000700' },
      });
    (performanceNotificationService.notifyReviewCycleSetup as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (performanceNotificationService.notifyReviewAssignments as ReturnType<typeof vi.fn>).mockResolvedValue(3);

    const result = await controller.setupReviewCycle('00000000-0000-0000-0000-000000000100', requestWithActor(actor()));

    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'CreatePerformanceReview',
      payload: expect.objectContaining({
        workerId,
        reviewCycleId: '00000000-0000-0000-0000-000000000100',
        managerId: managerWorkerId.value,
      }),
    }));
    expect(performanceNotificationService.notifyReviewCycleSetup).toHaveBeenCalledWith({
      tenantId: new Uuid(tenantId),
      cycleId: new Uuid('00000000-0000-0000-0000-000000000100'),
      cycleName: 'FY26 Annual Review',
      actorId: new Uuid(actorId),
    });
    expect(performanceNotificationService.notifyReviewAssignments).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: new Uuid(tenantId),
      cycleId: new Uuid('00000000-0000-0000-0000-000000000100'),
      assignments: [expect.objectContaining({
        reviewId: '00000000-0000-0000-0000-000000000700',
        workerId: new Uuid(workerId),
        managerId: managerWorkerId,
      })],
    }));
    expect(result).toEqual({
      success: true,
      notificationsCreated: 2,
      reviewAssignmentsCreated: 1,
      reviewTaskNotificationsCreated: 3,
    });
  });

  it('launches a 360 cycle and creates eligible peer review assignments', async () => {
    const peerWorkerId = '00000000-0000-0000-0000-000000000022';
    const departmentId = new Uuid('00000000-0000-0000-0000-000000000099');
    (feedback360CycleRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid('00000000-0000-0000-0000-000000000200'),
      tenantId: new Uuid(tenantId),
      name: 'FY26 360 Feedback',
      status: 'ACTIVE',
      aggregateVersion: 1,
      anonymityEnabled: true,
      minPeerReviews: 1,
      maxPeerReviews: 1,
    });
    (workerRepo.findActive as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: new Uuid(workerId), tenantId: new Uuid(tenantId), departmentId, managerId: new Uuid('00000000-0000-0000-0000-000000000030') },
      { id: new Uuid(peerWorkerId), tenantId: new Uuid(tenantId), departmentId, managerId: new Uuid('00000000-0000-0000-0000-000000000030') },
    ]);
    (feedback360ResponseRepo.findByCycle as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (commandBus.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true, data: { feedback360ResponseId: '00000000-0000-0000-0000-000000000301' } })
      .mockResolvedValueOnce({ success: true, data: { feedback360ResponseId: '00000000-0000-0000-0000-000000000302' } });
    (performanceNotificationService.notifyPeerReviewRequest as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const result = await controller.launchFeedback360Cycle('00000000-0000-0000-0000-000000000200', requestWithActor(actor()));

    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'CreatePerformanceFeedback360Response',
      payload: expect.objectContaining({
        cycleId: '00000000-0000-0000-0000-000000000200',
        relationshipType: 'PEER',
        isAnonymous: true,
      }),
    }));
    expect(performanceNotificationService.notifyPeerReviewRequest).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      success: true,
      feedbackRequestsCreated: 2,
      feedbackNotificationsCreated: 2,
      feedbackCoverageWarnings: [],
    });
  });

  it('notifies the reviewer after a peer feedback assignment is created', async () => {
    (feedback360CycleRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid('00000000-0000-0000-0000-000000000200'),
      tenantId: new Uuid(tenantId),
      name: 'FY26 360 Feedback',
    });
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { feedback360ResponseId: '00000000-0000-0000-0000-000000000300' },
    });
    (performanceNotificationService.notifyPeerReviewRequest as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    await controller.createFeedback360Response({
      cycleId: '00000000-0000-0000-0000-000000000200',
      revieweeId: workerId,
      reviewerId: '00000000-0000-0000-0000-000000000202',
      relationshipType: 'PEER',
      isAnonymous: true,
    }, requestWithActor(actor()));

    expect(performanceNotificationService.notifyPeerReviewRequest).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: new Uuid('00000000-0000-0000-0000-000000000200'),
      cycleName: 'FY26 360 Feedback',
      revieweeId: new Uuid(workerId),
      reviewerId: new Uuid('00000000-0000-0000-0000-000000000202'),
      feedback360ResponseId: '00000000-0000-0000-0000-000000000300',
      isAnonymous: true,
    }));
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

  it('builds manager dashboard analytics from the manager direct reports', async () => {
    const managerId = '00000000-0000-0000-0000-000000000030';
    const manager = {
      id: new Uuid(managerId),
      tenantId: new Uuid(tenantId),
      firstName: 'Nader',
      lastName: 'Hassan',
      email: { value: 'manager@example.com' },
    };
    const report = {
      id: new Uuid(workerId),
      tenantId: new Uuid(tenantId),
      firstName: 'Mona',
      lastName: 'Khaled',
      managerId: new Uuid(managerId),
    };
    (workerRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(manager);
    (workerRepo.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(manager);
    (workerRepo.findByManager as ReturnType<typeof vi.fn>).mockResolvedValue([report]);
    (reviewRepo.findByWorker as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (goalRepo.findByWorker as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (objectiveRepo.findByOwner as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (feedback360ResponseRepo.findByReviewee as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (developmentPlanRepo.findByWorker as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (performanceAnalyticsService.buildCycleAnalytics as ReturnType<typeof vi.fn>).mockReturnValue({
      ratingDistribution: [],
      reviewCompletion: { total: 0 },
      goalMetrics: { total: 0 },
      peerFeedback: { submitted: 0 },
      calibrationHeatmap: [],
      nineBox: [{ workerId, box: 'Core contributor' }],
      recognitions: [],
      feedbackSummaries: {},
      actionPlans: [],
    });

    const result = await controller.getManagerPerformanceDashboard(managerId, requestWithActor(actor({
      roles: ['MANAGER'],
      permissions: ['PERFORMANCE_READ', 'PERFORMANCE_WRITE'],
      email: 'manager@example.com',
    })));

    expect(workerRepo.findByManager).toHaveBeenCalledWith(new Uuid(managerId));
    expect(performanceAnalyticsService.buildCycleAnalytics).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: `manager-dashboard:${managerId}`,
      workers: [report],
    }));
    expect(result).toEqual(expect.objectContaining({
      managerId,
      reportCount: 1,
      analytics: expect.objectContaining({ nineBox: [{ workerId, box: 'Core contributor' }] }),
    }));
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

  it('scopes feedback submission to the assigned reviewer', async () => {
    (feedback360ResponseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid('00000000-0000-0000-0000-000000000300'),
      cycleId: new Uuid('00000000-0000-0000-0000-000000000200'),
      revieweeId: new Uuid(workerId),
      reviewerId: new Uuid(actorId),
      status: 'PENDING',
      aggregateVersion: 0,
      isAnonymous: true,
    });
    (workerRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(actorId),
      email: { value: 'employee@example.com' },
    });
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    await controller.submitFeedback360Response('00000000-0000-0000-0000-000000000300', {
      competencyScores: { communication: 4 },
      dimensionScores: { communication: 4, professionalism: 5 },
      areaComments: { communication: 'Clear and direct' },
      overallRating: 4,
      strengths: 'Collaborative',
      improvements: 'Share earlier updates',
      comments: 'Useful teammate',
      isAnonymous: false,
    }, requestWithActor(actor({ roles: ['EMPLOYEE'], permissions: ['PERFORMANCE_WRITE'], email: 'employee@example.com' })));

    const command = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(command.subjectWorkerId.value).toBe(actorId);
    expect(command.payload.dimensionScores).toEqual({ communication: 4, professionalism: 5 });
    expect(command.payload.isAnonymous).toBe(false);
  });

  it('returns the manager review queue for a manager-scoped request', async () => {
    (workerRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(actorId),
      tenantId: new Uuid(tenantId),
    });
    (reviewRepo.findByManager as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid('00000000-0000-0000-0000-000000000701') }]);

    const result = await controller.getReviewsByManager(actorId, requestWithActor(actor({
      roles: ['MANAGER'],
      permissions: ['PERFORMANCE_READ'],
    })));

    expect(reviewRepo.findByManager).toHaveBeenCalledWith(new Uuid(actorId));
    expect(result).toEqual([{ id: new Uuid('00000000-0000-0000-0000-000000000701') }]);
  });

  it('declares specific collection routes before generic :id routes', () => {
    const routes = Object.getOwnPropertyNames(PerformanceController.prototype)
      .map((methodName) => ({
        methodName,
        path: Reflect.getMetadata(
          PATH_METADATA,
          PerformanceController.prototype[methodName as keyof PerformanceController] as object,
        ) as string | undefined,
      }))
      .filter((route): route is { methodName: string; path: string } => Boolean(route.path));

    const assertBefore = (specificPath: string, genericPath: string) => {
      const specificIndex = routes.findIndex((route) => route.path === specificPath);
      const genericIndex = routes.findIndex((route) => route.path === genericPath);
      expect(specificIndex).toBeGreaterThanOrEqual(0);
      expect(genericIndex).toBeGreaterThanOrEqual(0);
      expect(specificIndex).toBeLessThan(genericIndex);
    };

    assertBefore('review-cycles/tenant/:tenantId', 'review-cycles/:id');
    assertBefore('reviews/worker/:workerId', 'reviews/:id');
    assertBefore('reviews/cycle/:cycleId', 'reviews/:id');
    assertBefore('reviews/manager/:managerId', 'reviews/:id');
    assertBefore('goals/worker/:workerId', 'goals/:id');
    assertBefore('feedback-360-responses/cycle/:cycleId', 'feedback-360-responses/:id');
    assertBefore('feedback-360-responses/reviewee/:revieweeId', 'feedback-360-responses/:id');
    assertBefore('feedback-360-responses/reviewer/:reviewerId', 'feedback-360-responses/:id');
    assertBefore('review-templates/tenant/:tenantId', 'review-templates/:id');
    assertBefore('competencies/category/:category', 'competencies/:id');
    assertBefore('competencies/tenant/:tenantId', 'competencies/:id');
  });

  it('blocks self-service 360 feedback outside eligible peer or reporting-line relationships', async () => {
    (feedback360CycleRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid('00000000-0000-0000-0000-000000000200'),
      tenantId: new Uuid(tenantId),
      status: 'IN_PROGRESS',
      anonymityEnabled: true,
    });
    const reviewer = {
      id: new Uuid(actorId),
      tenantId: new Uuid(tenantId),
      email: { value: 'employee@example.com' },
      departmentId: new Uuid('00000000-0000-0000-0000-000000000901'),
      managerId: new Uuid('00000000-0000-0000-0000-000000000801'),
    };
    const reviewee = {
      id: new Uuid(workerId),
      tenantId: new Uuid(tenantId),
      email: { value: 'reviewee@example.com' },
      departmentId: new Uuid('00000000-0000-0000-0000-000000000902'),
      managerId: new Uuid('00000000-0000-0000-0000-000000000802'),
    };
    (workerRepo.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(reviewer);
    (workerRepo.findById as ReturnType<typeof vi.fn>).mockImplementation((id: Uuid) => {
      if (id.value === actorId) return Promise.resolve(reviewer);
      if (id.value === workerId) return Promise.resolve(reviewee);
      return Promise.resolve(undefined);
    });

    await expect(controller.createSelfServiceFeedback({
      cycleId: '00000000-0000-0000-0000-000000000200',
      revieweeId: workerId,
      relationshipType: 'PEER',
      competencyScores: { communication: 4 },
      overallRating: 4,
      strengths: 'Helpful',
      improvements: 'More updates',
      comments: 'Good teammate',
    }, requestWithActor(actor({
      roles: ['EMPLOYEE'],
      permissions: ['PERFORMANCE_CREATE', 'PERFORMANCE_WRITE'],
      email: 'employee@example.com',
    })))).rejects.toBeInstanceOf(BadRequestException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('loads child objectives by parent objective id, not review cycle id', async () => {
    const parentObjectiveId = '00000000-0000-0000-0000-000000000800';
    (objectiveRepo.findByParent as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid('00000000-0000-0000-0000-000000000801') }]);

    const result = await controller.getObjectivesByParent(parentObjectiveId, requestWithActor(actor({
      permissions: ['PERFORMANCE_READ'],
    })));

    expect(objectiveRepo.findByParent).toHaveBeenCalledWith(new Uuid(parentObjectiveId));
    expect(objectiveRepo.findByReviewCycle).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: new Uuid('00000000-0000-0000-0000-000000000801') }]);
  });
});
