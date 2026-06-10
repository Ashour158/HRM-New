import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from './guards/auth.guard.js';
import type { WorkerProfile } from './domains/hr-core/aggregates/worker-profile.aggregate.js';
import { PersonalDataRecordRepository } from './domains/hr-core/repositories/personal-data-record.repository.js';
import { WorkerRepository } from './domains/hr-core/repositories/worker.repository.js';
import { PerformanceReviewRepository } from './domains/performance/repositories/performance-review.repository.js';
import { GoalRepository } from './domains/performance/repositories/goal.repository.js';
import { Feedback360CycleRepository } from './domains/performance/repositories/feedback-360-cycle.repository.js';
import { Feedback360ResponseRepository } from './domains/performance/repositories/feedback-360-response.repository.js';
import { DevelopmentPlanRepository } from './domains/performance/repositories/development-plan.repository.js';
import { PerformanceImprovementPlanRepository } from './domains/performance/repositories/performance-improvement-plan.repository.js';
import { PerformanceAnalyticsService } from './domains/performance/services/performance-analytics.service.js';

type PayloadByCategory = Record<string, Record<string, unknown>>;

type ManagerTeamWorker = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  hireDate: string;
  status: string;
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
  managerId?: string;
  managerName?: string;
  legalEntityId?: string;
  legalEntityName?: string;
};

type ManagerTeamMember = {
  worker: ManagerTeamWorker;
  sourceWorker: WorkerProfile;
  compensationBand?: string;
};

@ApiTags('Manager Team')
@UseGuards(AuthGuard)
@Controller('manager')
export class ManagerTeamController {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly reviewRepo: PerformanceReviewRepository,
    private readonly goalRepo: GoalRepository,
    private readonly feedback360ResponseRepo: Feedback360ResponseRepository,
    private readonly developmentPlanRepo: DevelopmentPlanRepository,
    private readonly pipRepo: PerformanceImprovementPlanRepository,
    private readonly performanceAnalyticsService: PerformanceAnalyticsService,
    private readonly feedback360CycleRepo: Feedback360CycleRepository,
  ) {}

  @Get('team')
  async getTeam(@Req() req: Request, @Query('workerId') workerId?: string) {
    this.assertManagerActor(req);
    const tenantId = this.getTenantId(req);
    const manager = await this.resolveManagerWorker(req, tenantId);
    this.assertActiveManager(manager);

    const reports = (await this.workerRepo.findByManagerForTenant(manager.id, tenantId))
      .filter((worker) =>
        worker.tenantId.value === tenantId.value &&
        worker.managerId?.value === manager.id.value,
      );
    const teamMembers = await Promise.all(
      reports.map((worker) => this.toTeamMember(worker, tenantId, manager)),
    );
    const directReports = teamMembers.map((member) => member.worker);

    if (!workerId) {
      return { directReports };
    }

    const selected = teamMembers.find((member) => member.worker.id === workerId);
    if (!selected) {
      throw new ForbiddenException('Selected worker is not in your direct reports');
    }

    return {
      directReports,
      selectedMember: {
        ...selected.worker,
        compensationBand: selected.compensationBand,
        ...(await this.performanceDetail(selected.sourceWorker)),
      },
    };
  }

  private assertManagerActor(req: Request): void {
    const actor = req.actor;
    if (!actor || actor.actorType !== 'USER' || !actor.roles.includes('MANAGER')) {
      throw new ForbiddenException('Manager team access requires a manager user session');
    }
  }

  private getTenantId(req: Request): Uuid {
    if (typeof req.tenantId === 'string' && Uuid.isValid(req.tenantId)) {
      return new Uuid(req.tenantId);
    }
    throw new ForbiddenException('Authenticated tenant is required');
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }

  private async resolveManagerWorker(req: Request, tenantId: Uuid): Promise<WorkerProfile> {
    const actorId = this.getActorId(req);
    if (Uuid.isValid(actorId)) {
      const worker = await this.workerRepo.findByIdForTenant(new Uuid(actorId), tenantId);
      if (worker) return worker;
    }

    const email = (req.actor as { email?: string } | undefined)?.email;
    if (email) {
      const worker = await this.workerRepo.findByEmailForTenant(email, tenantId);
      if (worker) return worker;
    }

    throw new ForbiddenException('No manager employee profile is linked to the authenticated user');
  }

  private assertActiveManager(manager: WorkerProfile): void {
    if (manager.status !== 'ACTIVE' && manager.status !== 'REHIRED') {
      throw new ForbiddenException('Manager team access is available only to active workers');
    }
  }

  private async toTeamMember(
    worker: WorkerProfile,
    tenantId: Uuid,
    manager: WorkerProfile,
  ): Promise<ManagerTeamMember> {
    const payloadByCategory = await this.payloadByCategory(worker.id, tenantId);
    const basic = payloadByCategory.BASIC ?? {};
    const contact = payloadByCategory.CONTACT ?? {};
    const compensation = payloadByCategory.COMPENSATION ?? {};
    return {
      sourceWorker: worker,
      worker: {
        id: worker.id.value,
        employeeId: worker.employeeNumber,
        firstName: worker.firstName,
        lastName: worker.lastName,
        email: worker.email.toString(),
        phone: stringValue(basic.phone)
          ?? stringValue(basic.phoneNumber)
          ?? stringValue(basic.workPhoneNumber)
          ?? stringValue(contact.phone)
          ?? stringValue(contact.workPhoneNumber),
        hireDate: dateOnly(worker.hireDate) ?? '',
        status: worker.status,
        departmentId: worker.departmentId?.value,
        departmentName: stringValue(contact.departmentName),
        jobTitle: worker.jobTitle,
        managerId: worker.managerId?.value,
        managerName: stringValue(contact.managerName) ?? displayName(manager),
        legalEntityId: worker.legalEntityId?.value,
        legalEntityName: stringValue(contact.legalEntityName),
      },
      compensationBand: stringValue(compensation.compensationBand)
        ?? stringValue(compensation.band)
        ?? stringValue(compensation.payBand),
    };
  }

  private async performanceDetail(worker: WorkerProfile) {
    const [reviews, goals, feedbackResponses, developmentPlans, improvementPlans] = await Promise.all([
      this.reviewRepo.findByWorker(worker.id),
      this.goalRepo.findByWorker(worker.id),
      this.feedback360ResponseRepo.findByReviewee(worker.id),
      this.developmentPlanRepo.findByWorker(worker.id),
      this.pipRepo.findByWorker(worker.id),
    ]);
    const anonymityThreshold = await this.sourceFeedbackThreshold(feedbackResponses, worker.tenantId);
    const analytics = this.performanceAnalyticsService.buildCycleAnalytics({
      cycleId: `manager-team:${worker.id.value}`,
      anonymityThreshold,
      workers: [worker],
      reviews,
      goals,
      objectives: [],
      keyResults: [],
      feedbackResponses,
      developmentPlans,
      improvementPlans,
    });
    const latestReview = this.latestRatedReview(reviews);

    return {
      performanceRating: latestReview ? this.reviewRating(latestReview) : undefined,
      lastReviewDate: latestReview ? dateOnly(latestReview.updatedAt ?? latestReview.createdAt) : undefined,
      goals: goals.map((goal) => ({
        id: goal.id.value,
        title: goal.title,
        status: goal.status,
        progress: this.goalProgress(goal),
      })),
      performanceImpact: {
        actionPlan: analytics.actionPlans[0],
        feedbackSummary: analytics.feedbackSummaries[worker.id.value],
        nineBox: analytics.nineBox[0],
        goals: analytics.goalMetrics,
      },
    };
  }

  private feedbackCycleId(response: { cycleId?: unknown }): string | undefined {
    const cycleId = response.cycleId;
    if (cycleId instanceof Uuid) return cycleId.value;
    if (typeof cycleId === 'string' && Uuid.isValid(cycleId)) return cycleId;
    if (cycleId && typeof cycleId === 'object') {
      const value = (cycleId as { value?: unknown }).value;
      if (typeof value === 'string' && Uuid.isValid(value)) return value;
    }
    return undefined;
  }

  private async sourceFeedbackThreshold(
    feedbackResponses: Array<{ cycleId?: unknown }>,
    tenantId: Uuid,
  ): Promise<number | undefined> {
    const cycleIds = Array.from(new Set(
      feedbackResponses
        .map((response) => this.feedbackCycleId(response))
        .filter((cycleId): cycleId is string => Boolean(cycleId)),
    ));
    const feedbackCycles = (await Promise.all(
      cycleIds.map((cycleId) => this.feedback360CycleRepo.findById(new Uuid(cycleId))),
    ))
      .filter((cycle): cycle is NonNullable<typeof cycle> => Boolean(cycle));
    const thresholds = feedbackCycles
      .filter((cycle) => cycle.tenantId.value === tenantId.value)
      .map((cycle) => cycle.minPeerReviews)
      .filter((threshold): threshold is number => typeof threshold === 'number' && Number.isFinite(threshold) && threshold > 0);
    return thresholds.length ? Math.max(...thresholds) : undefined;
  }

  private latestRatedReview(
    reviews: Array<{ finalRating?: number; calibratedRating?: number; updatedAt?: Date; createdAt?: Date }>,
  ) {
    return reviews
      .filter((review) => typeof this.reviewRating(review) === 'number')
      .sort((a, b) => timestamp(b.updatedAt ?? b.createdAt) - timestamp(a.updatedAt ?? a.createdAt))[0];
  }

  private reviewRating(review: { finalRating?: number; calibratedRating?: number }): number | undefined {
    return typeof review.finalRating === 'number' ? review.finalRating : review.calibratedRating;
  }

  private goalProgress(goal: { targetValue?: number; currentValue?: number; status: string }): number {
    if (goal.status === 'ACHIEVED') return 100;
    if (!goal.targetValue || goal.targetValue <= 0) return 0;
    return Math.round(Math.min(Math.max(((goal.currentValue ?? 0) / goal.targetValue) * 100, 0), 100) * 100) / 100;
  }

  private async payloadByCategory(workerId: Uuid, tenantId: Uuid): Promise<PayloadByCategory> {
    const records = await this.personalDataRepo.findByWorkerForTenant(workerId, tenantId);
    return Object.fromEntries(records.map((record) => [record.dataCategory, record.payload ?? {}])) as PayloadByCategory;
  }
}

function dateOnly(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function displayName(worker: WorkerProfile): string {
  return `${worker.firstName} ${worker.lastName}`.trim() || worker.employeeNumber;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function timestamp(value: Date | string | undefined | null): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
