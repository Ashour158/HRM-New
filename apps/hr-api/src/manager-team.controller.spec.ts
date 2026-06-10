import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { ManagerTeamController } from './manager-team.controller.js';
import { PerformanceAnalyticsService } from './domains/performance/services/performance-analytics.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const otherTenantId = new Uuid('00000000-0000-0000-0000-000000000999');
const managerId = new Uuid('00000000-0000-0000-0000-000000000010');
const directReportId = new Uuid('00000000-0000-0000-0000-000000000011');
const peerId = new Uuid('00000000-0000-0000-0000-000000000012');

function request(roles = ['EMPLOYEE', 'MANAGER']): Request {
  return {
    tenantId: tenantId.value,
    actor: {
      actorType: 'USER',
      actorId: managerId,
      roles,
      permissions: [],
      mfaAuthenticated: true,
      email: 'manager@example.com',
    },
  } as unknown as Request;
}

function worker(overrides: Record<string, unknown> = {}) {
  return {
    id: directReportId,
    tenantId,
    employeeNumber: 'EMP-100',
    firstName: 'Mona',
    lastName: 'Saleh',
    email: { toString: () => 'mona.saleh@example.com' },
    hireDate: new Date('2024-01-15T00:00:00.000Z'),
    status: 'ACTIVE',
    jobTitle: 'Product Specialist',
    managerId,
    departmentId: new Uuid('00000000-0000-0000-0000-000000000101'),
    legalEntityId: new Uuid('00000000-0000-0000-0000-000000000201'),
    ...overrides,
  };
}

function makeController(options?: {
  workerRepo?: Record<string, ReturnType<typeof vi.fn>>;
  personalDataRepo?: Record<string, ReturnType<typeof vi.fn>>;
  reviewRepo?: Record<string, ReturnType<typeof vi.fn>>;
  goalRepo?: Record<string, ReturnType<typeof vi.fn>>;
  feedback360CycleRepo?: Record<string, ReturnType<typeof vi.fn>>;
  feedback360ResponseRepo?: Record<string, ReturnType<typeof vi.fn>>;
  developmentPlanRepo?: Record<string, ReturnType<typeof vi.fn>>;
  pipRepo?: Record<string, ReturnType<typeof vi.fn>>;
  performanceAnalyticsService?: PerformanceAnalyticsService;
}) {
  const manager = worker({
    id: managerId,
    employeeNumber: 'MGR-100',
    firstName: 'Line',
    lastName: 'Manager',
    email: { toString: () => 'manager@example.com' },
    managerId: undefined,
  });
  const workerRepo = options?.workerRepo ?? {
    findByIdForTenant: vi.fn(async () => manager),
    findByEmailForTenant: vi.fn(async () => manager),
    findByManagerForTenant: vi.fn(async () => [worker()]),
    findByManager: vi.fn(),
    findById: vi.fn(),
  };
  const personalDataRepo = options?.personalDataRepo ?? {
    findByWorkerForTenant: vi.fn(async () => [
      {
        dataCategory: 'CONTACT',
        payload: {
          departmentName: 'Product',
          legalEntityName: 'Nexus USA LLC',
          managerName: 'Line Manager',
        },
      },
      {
        dataCategory: 'COMPENSATION',
        payload: {
          compensationBand: 'P3',
        },
      },
    ]),
  };
  const reviewRepo = options?.reviewRepo ?? { findByWorker: vi.fn(async () => []) };
  const goalRepo = options?.goalRepo ?? { findByWorker: vi.fn(async () => []) };
  const feedback360CycleRepo = options?.feedback360CycleRepo ?? { findById: vi.fn(async () => undefined) };
  const feedback360ResponseRepo = options?.feedback360ResponseRepo ?? { findByReviewee: vi.fn(async () => []) };
  const developmentPlanRepo = options?.developmentPlanRepo ?? { findByWorker: vi.fn(async () => []) };
  const pipRepo = options?.pipRepo ?? { findByWorker: vi.fn(async () => []) };
  const performanceAnalyticsService = options?.performanceAnalyticsService ?? new PerformanceAnalyticsService();
  return {
    controller: new ManagerTeamController(
      workerRepo as never,
      personalDataRepo as never,
      reviewRepo as never,
      goalRepo as never,
      feedback360ResponseRepo as never,
      developmentPlanRepo as never,
      pipRepo as never,
      performanceAnalyticsService as never,
      feedback360CycleRepo as never,
    ),
    workerRepo,
    personalDataRepo,
    reviewRepo,
    goalRepo,
    feedback360CycleRepo,
    feedback360ResponseRepo,
    developmentPlanRepo,
    pipRepo,
  };
}

describe('ManagerTeamController', () => {
  it('returns only tenant-scoped direct reports for a manager and selected member detail', async () => {
    const crossTenantReport = worker({
      id: peerId,
      tenantId: otherTenantId,
      employeeNumber: 'EMP-999',
      firstName: 'Other',
      lastName: 'Tenant',
      email: { toString: () => 'other.tenant@example.com' },
    });
    const { controller, workerRepo, personalDataRepo } = makeController({
      workerRepo: {
        findByIdForTenant: vi.fn(async () => worker({
          id: managerId,
          employeeNumber: 'MGR-100',
          firstName: 'Line',
          lastName: 'Manager',
          email: { toString: () => 'manager@example.com' },
          managerId: undefined,
        })),
        findByEmailForTenant: vi.fn(),
        findByManagerForTenant: vi.fn(async () => [worker(), crossTenantReport]),
        findByManager: vi.fn(),
        findById: vi.fn(),
      },
    });

    const result = await controller.getTeam(request(), directReportId.value);

    expect(workerRepo.findByIdForTenant).toHaveBeenCalledWith(managerId, tenantId);
    expect(workerRepo.findByManagerForTenant).toHaveBeenCalledWith(managerId, tenantId);
    expect(workerRepo.findByManager).not.toHaveBeenCalled();
    expect(workerRepo.findById).not.toHaveBeenCalled();
    expect(personalDataRepo.findByWorkerForTenant).toHaveBeenCalledWith(directReportId, tenantId);
    expect(result.directReports).toEqual([
      expect.objectContaining({
        id: directReportId.value,
        employeeId: 'EMP-100',
        firstName: 'Mona',
        lastName: 'Saleh',
        departmentName: 'Product',
        managerName: 'Line Manager',
        legalEntityName: 'Nexus USA LLC',
      }),
    ]);
    expect(result.selectedMember).toEqual(expect.objectContaining({
      id: directReportId.value,
      compensationBand: 'P3',
      goals: [],
    }));
  });

  it('projects selected member performance impact from reviews, 360 feedback, goals, and action plans', async () => {
    const goalId = new Uuid('00000000-0000-0000-0000-000000000301');
    const reviewRepo = {
      findByWorker: vi.fn(async () => [{
        id: new Uuid('00000000-0000-0000-0000-000000000201'),
        workerId: directReportId,
        finalRating: 4.2,
        status: 'FINALIZED',
        updatedAt: new Date('2026-06-05T10:00:00.000Z'),
      }]),
    };
    const goalRepo = {
      findByWorker: vi.fn(async () => [{
        id: goalId,
        workerId: directReportId,
        title: 'Launch readiness',
        targetValue: 100,
        currentValue: 55,
        status: 'IN_PROGRESS',
      }]),
    };
    const feedback360ResponseRepo = {
      findByReviewee: vi.fn(async () => [{
        id: new Uuid('00000000-0000-0000-0000-000000000401'),
        revieweeId: directReportId,
        reviewerId: peerId,
        relationshipType: 'PEER',
        status: 'SUBMITTED',
        overallRating: 4.5,
        strengths: 'Keeps peers aligned',
        improvements: 'Escalate delivery risks earlier',
        isAnonymous: false,
      }]),
    };
    const pipRepo = {
      findByWorker: vi.fn(async () => [{
        id: new Uuid('00000000-0000-0000-0000-000000000501'),
        workerId: directReportId,
        status: 'ACTIVE',
        objectives: ['Raise launch goal delivery above 75%'],
        planDurationDays: 45,
        checkInCadence: 'Twice-weekly manager action-plan check-in',
        trackingMetrics: [{ metric: 'Launch readiness', current: 55, target: 75, unit: '%' }],
        successCriteria: ['Two consecutive launch milestones land on time'],
      }]),
    };
    const { controller } = makeController({
      reviewRepo,
      goalRepo,
      feedback360ResponseRepo,
      pipRepo,
    });

    const result = await controller.getTeam(request(), directReportId.value);

    expect(reviewRepo.findByWorker).toHaveBeenCalledWith(directReportId);
    expect(goalRepo.findByWorker).toHaveBeenCalledWith(directReportId);
    expect(feedback360ResponseRepo.findByReviewee).toHaveBeenCalledWith(directReportId);
    expect(pipRepo.findByWorker).toHaveBeenCalledWith(directReportId);
    expect(result.selectedMember).toEqual(expect.objectContaining({
      performanceRating: 4.2,
      lastReviewDate: '2026-06-05',
      goals: [{
        id: goalId.value,
        title: 'Launch readiness',
        status: 'IN_PROGRESS',
        progress: 55,
      }],
      performanceImpact: expect.objectContaining({
        feedbackSummary: expect.objectContaining({
          averageRating: 4.5,
          responseCount: 1,
        }),
        actionPlan: expect.objectContaining({
          riskLevel: 'MEDIUM',
          checkInCadence: 'Twice-weekly manager action-plan check-in',
          recommendedActions: expect.arrayContaining([
            'Advance action plan objective: Raise launch goal delivery above 75%',
          ]),
        }),
      }),
    }));
  });

  it('suppresses selected-member 360 summaries until the source cycle threshold is met', async () => {
    const feedbackCycleId = new Uuid('00000000-0000-0000-0000-000000000701');
    const feedback360CycleRepo = {
      findById: vi.fn(async () => ({
        id: feedbackCycleId,
        tenantId,
        minPeerReviews: 5,
      })),
    };
    const feedback360ResponseRepo = {
      findByReviewee: vi.fn(async () => Array.from({ length: 4 }, (_, index) => ({
        id: new Uuid(`00000000-0000-0000-0000-00000000080${index}`),
        tenantId,
        cycleId: feedbackCycleId,
        revieweeId: directReportId,
        reviewerId: peerId,
        relationshipType: 'PEER',
        status: 'SUBMITTED',
        overallRating: 2,
        strengths: `Strength ${index}`,
        improvements: `Improve ${index}`,
        isAnonymous: true,
      }))),
    };
    const { controller } = makeController({
      feedback360CycleRepo,
      feedback360ResponseRepo,
    });

    const result = await controller.getTeam(request(), directReportId.value);

    expect(feedback360CycleRepo.findById).toHaveBeenCalledWith(feedbackCycleId);
    expect(result.selectedMember.performanceImpact.feedbackSummary).toEqual(expect.objectContaining({
      responseCount: 4,
      anonymousResponseCount: 4,
      averageRating: null,
      strengths: [],
      improvements: [],
      anonymitySuppressionApplied: true,
    }));
    expect(result.selectedMember.performanceImpact.feedbackSummary.conciseFeedback).toContain('5 submitted responses');
  });

  it('rejects employee users before resolving manager team data', async () => {
    const { controller, workerRepo, personalDataRepo } = makeController();

    await expect(controller.getTeam(request(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);

    expect(workerRepo.findByIdForTenant).not.toHaveBeenCalled();
    expect(workerRepo.findByManagerForTenant).not.toHaveBeenCalled();
    expect(personalDataRepo.findByWorkerForTenant).not.toHaveBeenCalled();
  });

  it('returns an empty direct report list for a manager without reports', async () => {
    const { controller } = makeController({
      workerRepo: {
        findByIdForTenant: vi.fn(async () => worker({
          id: managerId,
          employeeNumber: 'MGR-100',
          firstName: 'Line',
          lastName: 'Manager',
          email: { toString: () => 'manager@example.com' },
          managerId: undefined,
        })),
        findByEmailForTenant: vi.fn(),
        findByManagerForTenant: vi.fn(async () => []),
        findByManager: vi.fn(),
        findById: vi.fn(),
      },
    });

    await expect(controller.getTeam(request())).resolves.toEqual({ directReports: [] });
  });

  it('rejects selected workers outside the manager direct reports', async () => {
    const { controller, personalDataRepo } = makeController();

    await expect(controller.getTeam(request(), peerId.value)).rejects.toBeInstanceOf(ForbiddenException);

    expect(personalDataRepo.findByWorkerForTenant).not.toHaveBeenCalledWith(peerId, tenantId);
  });
});
