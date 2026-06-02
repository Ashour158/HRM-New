import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';

// Repositories — existing
import { PerformanceReviewCycleRepository } from '../repositories/performance-review-cycle.repository.js';
import { PerformanceReviewRepository } from '../repositories/performance-review.repository.js';
import { GoalRepository } from '../repositories/goal.repository.js';
import { CalibrationSessionRepository } from '../repositories/calibration-session.repository.js';
import { PerformanceImprovementPlanRepository } from '../repositories/performance-improvement-plan.repository.js';

// Repositories — new
import { Feedback360CycleRepository } from '../repositories/feedback-360-cycle.repository.js';
import { Feedback360ResponseRepository } from '../repositories/feedback-360-response.repository.js';
import { ObjectiveRepository } from '../repositories/objective.repository.js';
import { KeyResultRepository } from '../repositories/key-result.repository.js';
import { KpiRepository } from '../repositories/kpi.repository.js';
import { KpiMeasurementRepository } from '../repositories/kpi-measurement.repository.js';
import { ReviewTemplateRepository } from '../repositories/review-template.repository.js';
import { CompetencyRepository } from '../repositories/competency.repository.js';
import { DevelopmentPlanRepository } from '../repositories/development-plan.repository.js';
import { PerformanceNotificationRepository } from '../repositories/performance-notification.repository.js';
import { PerformanceAnalyticsService } from '../services/performance-analytics.service.js';
import { PerformanceNotificationService } from '../services/performance-notification.service.js';

import type * as dtos from './dtos.js';
import {
  // Existing
  CreatePerformanceReviewCycleDtoSchema, CreatePerformanceReviewDtoSchema,
  SubmitSelfReviewDtoSchema, SubmitManagerReviewDtoSchema,
  CalibratePerformanceReviewDtoSchema, FinalizePerformanceReviewDtoSchema,
  CreateGoalDtoSchema, UpdateGoalProgressDtoSchema,
  CreateCalibrationSessionDtoSchema,
  CreatePerformanceImprovementPlanDtoSchema, CompletePerformanceImprovementPlanDtoSchema, ExtendPerformanceImprovementPlanDtoSchema, RecordPerformanceImprovementPlanCheckpointDtoSchema,
  // New
  CreateFeedback360CycleDtoSchema, CreateFeedback360ResponseDtoSchema, SubmitFeedback360ResponseDtoSchema, CreateSelfServiceFeedbackDtoSchema,
  CreateObjectiveDtoSchema, UpdateObjectiveProgressDtoSchema,
  CreateKeyResultDtoSchema, UpdateKeyResultProgressDtoSchema,
  CreateKpiDtoSchema, UpdateKpiActualDtoSchema, AssignKpiOwnerDtoSchema,
  RecordKpiMeasurementDtoSchema, ValidateKpiMeasurementDtoSchema,
  CreateReviewTemplateDtoSchema,
  CreateCompetencyDtoSchema,
  CreateDevelopmentPlanDtoSchema, RecordDevelopmentMilestoneDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

@ApiTags('Performance')
@UseGuards(AuthGuard)
@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly cycleRepo: PerformanceReviewCycleRepository,
    private readonly reviewRepo: PerformanceReviewRepository,
    private readonly goalRepo: GoalRepository,
    private readonly calibrationRepo: CalibrationSessionRepository,
    private readonly pipRepo: PerformanceImprovementPlanRepository,
    private readonly feedback360CycleRepo: Feedback360CycleRepository,
    private readonly feedback360ResponseRepo: Feedback360ResponseRepository,
    private readonly objectiveRepo: ObjectiveRepository,
    private readonly keyResultRepo: KeyResultRepository,
    private readonly kpiRepo: KpiRepository,
    private readonly kpiMeasurementRepo: KpiMeasurementRepository,
    private readonly reviewTemplateRepo: ReviewTemplateRepository,
    private readonly competencyRepo: CompetencyRepository,
    private readonly developmentPlanRepo: DevelopmentPlanRepository,
    private readonly workerRepo: WorkerRepository,
    private readonly performanceNotificationService: PerformanceNotificationService,
    private readonly performanceAnalyticsService: PerformanceAnalyticsService,
    private readonly performanceNotificationRepo: PerformanceNotificationRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    if (!req.actor) {
      throw new ForbiddenException('Authenticated actor is required');
    }
    const actor = req.actor;
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor,
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: this.mapRoleToClientType(actor.roles[0]) },
    };
  }

  private mapRoleToClientType(role?: string): 'HR_ADMIN' | 'MANAGER_PORTAL' | 'EMPLOYEE_PORTAL' | 'SYSTEM' {
    switch (role) {
      case 'HR_ADMIN':
      case 'HRBP':
      case 'PERFORMANCE_ADMIN':
      case 'SUPER_ADMIN':
        return 'HR_ADMIN';
      case 'MANAGER':
        return 'MANAGER_PORTAL';
      case 'EMPLOYEE':
        return 'EMPLOYEE_PORTAL';
      default:
        return 'SYSTEM';
    }
  }

  private async executeCommand(command: HrCommandEnvelope<unknown>): Promise<unknown> {
    const result = await this.commandBus.execute(command);
    if (result && typeof result === 'object' && 'success' in result && result.success === false) {
      const errorResult = result as { errorCode: string; errorMessage: string };
      switch (errorResult.errorCode) {
        case 'COMMAND_HANDLER_NOT_FOUND':
          throw new NotFoundException(errorResult.errorMessage);
        case 'TENANT_RESOLUTION_FAILED':
        case 'TENANT_NOT_FOUND':
        case 'UNAUTHORIZED':
        case 'UNAUTHENTICATED_ACTOR':
          throw new UnauthorizedException(errorResult.errorMessage);
        case 'ACCESS_CONTROL_DENIED':
        case 'SOD_VIOLATION':
          throw new ForbiddenException(errorResult.errorMessage);
        case 'FSM_TRANSITION_NOT_ALLOWED':
        case 'INVALID_PAYLOAD':
        case 'IDEMPOTENCY_HASH_MISMATCH':
          throw new BadRequestException(errorResult.errorMessage);
        case 'MODULE_DISABLED':
        case 'TENANT_INACTIVE':
          throw new ConflictException(errorResult.errorMessage);
        default:
          throw new BadRequestException(errorResult.errorMessage);
      }
    }
    return result;
  }

  private subjectWorkerId(workerId?: string): { subjectWorkerId?: Uuid } {
    return workerId ? { subjectWorkerId: new Uuid(workerId) } : {};
  }

  private tenantIdFromRequest(req: Request): Uuid {
    return new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
  }

  private mergeCommandResult(result: unknown, extra: Record<string, unknown>): unknown {
    return result && typeof result === 'object' ? { ...(result as Record<string, unknown>), ...extra } : { result, ...extra };
  }

  private commandDataValue(result: unknown, key: string): string | undefined {
    const data = (result as { data?: Record<string, unknown> } | undefined)?.data;
    const value = data?.[key];
    return typeof value === 'string' ? value : undefined;
  }

  private requireActor(req: Request) {
    if (!req.actor) {
      throw new ForbiddenException('Authenticated actor is required');
    }
    return req.actor;
  }

  private isPrivilegedPerformanceActor(req: Request): boolean {
    const actor = this.requireActor(req);
    return actor.actorType === 'SYSTEM'
      || actor.actorType === 'SERVICE_ACCOUNT'
      || actor.roles.some((role) => ['HR_ADMIN', 'HRBP', 'PERFORMANCE_ADMIN', 'SUPER_ADMIN'].includes(role));
  }

  private getWorkerEmail(worker: unknown): string | undefined {
    const email = (worker as { email?: unknown }).email;
    if (typeof email === 'string') return email;
    if (email && typeof email === 'object' && 'value' in email && typeof email.value === 'string') return email.value;
    if (email && typeof (email as { toString?: unknown }).toString === 'function') {
      const value = (email as { toString: () => string }).toString();
      return value === '[object Object]' ? undefined : value;
    }
    return undefined;
  }

  private async assertCanAccessWorker(req: Request, workerId: string): Promise<void> {
    const actor = this.requireActor(req);
    if (this.isPrivilegedPerformanceActor(req)) return;

    const worker = await this.workerRepo.findById(new Uuid(workerId));
    if (!worker) throw new NotFoundException('Worker not found');

    if ((worker as { id?: Uuid }).id?.value === actor.actorId.value) return;

    const workerEmail = this.getWorkerEmail(worker);
    if (actor.email && workerEmail?.toLowerCase() === actor.email.toLowerCase()) return;

    const managerId = (worker as { managerId?: Uuid }).managerId?.value;
    if (actor.roles.includes('MANAGER')) {
      if (managerId === actor.actorId.value) return;
      if (actor.email) {
        const managerWorker = await this.workerRepo.findByEmail(actor.email);
        if (managerWorker?.id.value === managerId) return;
      }
    }

    throw new ForbiddenException('Performance records are scoped to self, reporting line, or HR performance roles');
  }

  private assertCanAccessTenant(req: Request, tenantId: string): void {
    const actor = this.requireActor(req);
    const requestTenantId = (req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001';
    if (requestTenantId !== tenantId) {
      throw new ForbiddenException('Tenant scope mismatch');
    }
    const hasPerformanceScope =
      actor.permissions.some((permission) => ['PERFORMANCE_CREATE', 'PERFORMANCE_WRITE', 'PERFORMANCE_APPROVE'].includes(permission)) ||
      actor.roles.some((role) => ['HR_ADMIN', 'HRBP', 'PERFORMANCE_ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(role));
    if (!hasPerformanceScope) {
      throw new ForbiddenException('Performance query access denied');
    }
  }

  private assertCanReadOrganizationalPerformance(req: Request): void {
    const actor = this.requireActor(req);
    const hasOrganizationalScope =
      this.isPrivilegedPerformanceActor(req) ||
      actor.roles.includes('MANAGER') ||
      actor.permissions.some((permission) => ['PERFORMANCE_WRITE', 'PERFORMANCE_APPROVE'].includes(permission));
    if (!hasOrganizationalScope) {
      throw new ForbiddenException('Organizational performance data requires manager or HR performance scope');
    }
  }

  private presentFeedbackResponse(
    response: {
      id: Uuid;
      tenantId: Uuid;
      cycleId: Uuid;
      revieweeId: Uuid;
      reviewerId: Uuid;
      relationshipType: string;
      status: string;
      competencyScores?: Record<string, number>;
      overallRating?: number;
      strengths?: string;
      improvements?: string;
      comments?: string;
      dimensionScores?: Record<string, number>;
      areaComments?: Record<string, string>;
      visibility?: 'NAMED' | 'ANONYMOUS';
      isAnonymous: boolean;
      submittedAt?: Date;
      withdrawnAt?: Date;
      createdAt: Date;
      updatedAt: Date;
    },
    req: Request,
    identityScopeWorkerId?: string,
  ): Record<string, unknown> {
    const actor = this.requireActor(req);
    const canSeeReviewer = this.isPrivilegedPerformanceActor(req)
      || identityScopeWorkerId === response.reviewerId.value
      || actor.actorId.value === response.reviewerId.value;
    return {
      id: response.id.value,
      tenantId: response.tenantId.value,
      cycleId: response.cycleId.value,
      revieweeId: response.revieweeId.value,
      reviewerId: response.isAnonymous && !canSeeReviewer ? null : response.reviewerId.value,
      relationshipType: response.relationshipType,
      status: response.status,
      competencyScores: response.competencyScores,
      overallRating: response.overallRating,
      strengths: response.strengths,
      improvements: response.improvements,
      comments: response.comments,
      dimensionScores: response.dimensionScores,
      areaComments: response.areaComments,
      visibility: response.visibility,
      isAnonymous: response.isAnonymous,
      submittedAt: response.submittedAt,
      withdrawnAt: response.withdrawnAt,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }

  private async canAccessWorker(req: Request, workerId: string): Promise<boolean> {
    try {
      await this.assertCanAccessWorker(req, workerId);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) return false;
      throw error;
    }
  }

  private async assertCanAccessFeedbackResponse(req: Request, response: { revieweeId: Uuid; reviewerId: Uuid }): Promise<void> {
    if (this.isPrivilegedPerformanceActor(req)) return;
    if (await this.canAccessWorker(req, response.revieweeId.value)) return;
    if (await this.canAccessWorker(req, response.reviewerId.value)) return;
    throw new ForbiddenException('Feedback response access is scoped to reviewee, reviewer, manager line, or HR performance roles');
  }

  private async assertCanSubmitFeedbackResponse(req: Request, response: { reviewerId: Uuid }): Promise<void> {
    if (this.isPrivilegedPerformanceActor(req)) return;
    await this.assertCanAccessWorker(req, response.reviewerId.value);
  }

  private async currentWorkerForRequest(req: Request) {
    const actor = this.requireActor(req);
    const byId = await this.workerRepo.findById(actor.actorId);
    if (byId) return byId;
    if (actor.email) {
      const byEmail = await this.workerRepo.findByEmail(actor.email);
      if (byEmail) return byEmail;
    }
    throw new ForbiddenException('Authenticated actor is not linked to an employee record');
  }

  private sameOptionalUuid(left?: Uuid, right?: Uuid): boolean {
    return Boolean(left?.value && right?.value && left.value === right.value);
  }

  private feedbackRelationshipType(
    reviewee: { id: Uuid; departmentId?: Uuid; managerId?: Uuid },
    reviewer: { id: Uuid; departmentId?: Uuid; managerId?: Uuid },
  ): 'PEER' | 'MANAGER' | 'DIRECT_REPORT' | undefined {
    if (reviewee.managerId?.value === reviewer.id.value) return 'MANAGER';
    if (reviewer.managerId?.value === reviewee.id.value) return 'DIRECT_REPORT';
    if (this.sameOptionalUuid(reviewee.departmentId, reviewer.departmentId) || this.sameOptionalUuid(reviewee.managerId, reviewer.managerId)) {
      return 'PEER';
    }
    return undefined;
  }

  private async assertSelfServiceFeedbackEligibility(
    cycle: { status: string; tenantId: Uuid },
    reviewer: { id: Uuid; tenantId: Uuid; departmentId?: Uuid; managerId?: Uuid },
    reviewee: { id: Uuid; tenantId: Uuid; departmentId?: Uuid; managerId?: Uuid },
    relationshipType: string,
  ): Promise<void> {
    if (!['ACTIVE', 'IN_PROGRESS'].includes(cycle.status)) {
      throw new BadRequestException('360 feedback can only be submitted during an active or launched cycle');
    }
    if (reviewer.tenantId.value !== cycle.tenantId.value || reviewee.tenantId.value !== cycle.tenantId.value) {
      throw new ForbiddenException('360 feedback is tenant scoped');
    }

    const relationship = relationshipType.toUpperCase();
    const sameDepartment = this.sameOptionalUuid(reviewer.departmentId, reviewee.departmentId);
    const sameManager = this.sameOptionalUuid(reviewer.managerId, reviewee.managerId);
    const reviewerIsManager = reviewee.managerId?.value === reviewer.id.value;
    const revieweeIsManager = reviewer.managerId?.value === reviewee.id.value;

    const eligible =
      (['PEER', 'COLLEAGUE'].includes(relationship) && (sameDepartment || sameManager)) ||
      (['MANAGER', 'MANAGER_REVIEW'].includes(relationship) && reviewerIsManager) ||
      (['DIRECT_REPORT', 'REPORT'].includes(relationship) && revieweeIsManager);

    if (!eligible) {
      throw new BadRequestException('360 feedback reviewer is not eligible for the selected relationship');
    }
  }

  private async buildCycleAnalytics(cycleId: string, req: Request) {
    this.assertCanReadOrganizationalPerformance(req);
    const cycle = await this.cycleRepo.findById(new Uuid(cycleId));
    if (!cycle) throw new NotFoundException('Review cycle not found');
    this.assertCanAccessTenant(req, cycle.tenantId.value);

    const workers = (await this.workerRepo.findActive()).filter((worker) => worker.tenantId.value === cycle.tenantId.value);
    const reviews = await this.reviewRepo.findByReviewCycle(cycle.id);
    const goals = (await Promise.all(workers.map((worker) => this.goalRepo.findByWorker(worker.id)))).flat();
    const objectives = await this.objectiveRepo.findByReviewCycle(cycle.id);
    const keyResults = (await Promise.all(objectives.map((objective) => this.keyResultRepo.findByObjective(objective.id)))).flat();
    const feedbackCycles = (await this.feedback360CycleRepo.findByTenant(cycle.tenantId))
      .filter((feedbackCycle) => feedbackCycle.reviewCycleId?.value === cycle.id.value);
    const feedbackResponses = (await Promise.all(feedbackCycles.map((feedbackCycle) => this.feedback360ResponseRepo.findByCycle(feedbackCycle.id)))).flat();
    const developmentPlans = (await Promise.all(workers.map((worker) => this.developmentPlanRepo.findByWorker(worker.id)))).flat();

    return this.performanceAnalyticsService.buildCycleAnalytics({
      cycleId,
      anonymityThreshold: feedbackCycles.length
        ? Math.max(1, Math.min(...feedbackCycles.map((feedbackCycle) => feedbackCycle.minPeerReviews ?? 3)))
        : 3,
      workers,
      reviews,
      goals,
      objectives,
      keyResults,
      feedbackResponses,
      developmentPlans,
    });
  }

  @Get('analytics/cycle/:cycleId')
  async getCycleAnalytics(@Param('cycleId') cycleId: string, @Req() req: Request) {
    return this.buildCycleAnalytics(cycleId, req);
  }

  @Get('analytics/manager/:managerId')
  async getManagerPerformanceDashboard(@Param('managerId') managerId: string, @Req() req: Request) {
    const manager = await this.workerRepo.findById(new Uuid(managerId));
    if (!manager) throw new NotFoundException('Manager employee record not found');
    await this.assertCanAccessWorker(req, managerId);

    const reports = (await this.workerRepo.findByManager(new Uuid(managerId)))
      .filter((worker) => worker.tenantId.value === manager.tenantId.value);
    const reviews = (await Promise.all(reports.map((worker) => this.reviewRepo.findByWorker(worker.id)))).flat();
    const goals = (await Promise.all(reports.map((worker) => this.goalRepo.findByWorker(worker.id)))).flat();
    const objectives = (await Promise.all(reports.map((worker) => this.objectiveRepo.findByOwner(worker.id)))).flat();
    const keyResults = (await Promise.all(objectives.map((objective) => this.keyResultRepo.findByObjective(objective.id)))).flat();
    const feedbackResponses = (await Promise.all(reports.map((worker) => this.feedback360ResponseRepo.findByReviewee(worker.id)))).flat();
    const developmentPlans = (await Promise.all(reports.map((worker) => this.developmentPlanRepo.findByWorker(worker.id)))).flat();
    const analytics = this.performanceAnalyticsService.buildCycleAnalytics({
      cycleId: `manager-dashboard:${managerId}`,
      workers: reports,
      reviews,
      goals,
      objectives,
      keyResults,
      feedbackResponses,
      developmentPlans,
    });

    return {
      managerId,
      managerName: [manager.firstName, manager.lastName].filter(Boolean).join(' ') || managerId,
      reportCount: reports.length,
      analytics,
    };
  }

  @Get('action-plans/worker/:workerId')
  async getEmployeeActionPlan(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId);
    const worker = await this.workerRepo.findById(new Uuid(workerId));
    if (!worker) throw new NotFoundException('Worker not found');
    const reviews = await this.reviewRepo.findByWorker(worker.id);
    const goals = await this.goalRepo.findByWorker(worker.id);
    const objectives = await this.objectiveRepo.findByOwner(worker.id);
    const keyResults = (await Promise.all(objectives.map((objective) => this.keyResultRepo.findByObjective(objective.id)))).flat();
    const feedbackResponses = await this.feedback360ResponseRepo.findByReviewee(worker.id);
    const developmentPlans = await this.developmentPlanRepo.findByWorker(worker.id);
    const analytics = this.performanceAnalyticsService.buildCycleAnalytics({
      cycleId: 'employee-action-plan',
      workers: [worker],
      reviews,
      goals,
      objectives,
      keyResults,
      feedbackResponses,
      developmentPlans,
    });
    return {
      workerId,
      actionPlan: analytics.actionPlans[0],
      feedbackSummary: analytics.feedbackSummaries[workerId],
      nineBox: analytics.nineBox[0],
      goals: analytics.goalMetrics,
    };
  }

  @Get('notifications/worker/:workerId')
  async getPerformanceNotifications(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId);
    return this.performanceNotificationRepo.findByWorker(this.tenantIdFromRequest(req).value, workerId);
  }

  @Post('notifications/:id/commands/read')
  async markPerformanceNotificationRead(@Param('id') id: string, @Body() body: { workerId?: string }, @Req() req: Request) {
    if (!body.workerId) throw new BadRequestException('workerId is required');
    await this.assertCanAccessWorker(req, body.workerId);
    const notification = await this.performanceNotificationRepo.markRead(this.tenantIdFromRequest(req).value, id, body.workerId);
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  /* ═══════════════════════════════════════════════════════════════
     Performance Review Cycles
     ═══════════════════════════════════════════════════════════════ */
  @Post('review-cycles')
  async createReviewCycle(@Body(new ZodValidationPipe(CreatePerformanceReviewCycleDtoSchema)) dto: dtos.CreatePerformanceReviewCycleDto, @Req() req: Request) {
    if (dto.templateId) {
      const template = await this.reviewTemplateRepo.findById(new Uuid(dto.templateId));
      if (!template) throw new NotFoundException('Review template not found');
      this.assertCanAccessTenant(req, template.tenantId.value);
      if (template.status !== 'ACTIVE') {
        throw new BadRequestException('Review cycles can only use active review templates');
      }
    }
    return this.executeCommand(this.buildCommand('CreatePerformanceReviewCycle', 'PerformanceReviewCycle', dto, req));
  }

  @Post('review-cycles/:id/commands/setup')
  async setupReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    const result = await this.executeCommand(this.buildCommand('SetupPerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
    const activeWorkers = (await this.workerRepo.findActive()).filter((worker) => worker.tenantId.value === ar.tenantId.value);
    const existingReviews = await this.reviewRepo.findByReviewCycle(ar.id);
    const existingReviewKeys = new Set(existingReviews.map((review) => `${review.workerId.value}:${review.reviewCycleId.value}`));
    const reviewAssignments: Array<{
      reviewId: string;
      workerId: Uuid;
      managerId?: Uuid;
      selfReviewDueDate?: Date;
      managerReviewDueDate?: Date;
    }> = [];
    const periods = (ar as { periods?: Array<{ name?: string; endDate?: Date }> }).periods ?? [];
    const selfReviewDueDate = periods.find((period) => period.name?.toLowerCase().includes('self'))?.endDate;
    const managerReviewDueDate = periods.find((period) => period.name?.toLowerCase().includes('manager'))?.endDate;

    for (const worker of activeWorkers) {
      if (!worker.managerId) continue;
      const key = `${worker.id.value}:${ar.id.value}`;
      if (existingReviewKeys.has(key)) continue;
      const createReviewResult = await this.executeCommand(this.buildCommand('CreatePerformanceReview', 'PerformanceReview', {
        workerId: worker.id.value,
        reviewCycleId: ar.id.value,
        managerId: worker.managerId.value,
      }, req, { subjectWorkerId: worker.id }));
      const reviewId = this.commandDataValue(createReviewResult, 'performanceReviewId');
      if (!reviewId) continue;
      reviewAssignments.push({
        reviewId,
        workerId: worker.id,
        managerId: worker.managerId,
        selfReviewDueDate,
        managerReviewDueDate,
      });
    }

    const notificationsCreated = await this.performanceNotificationService.notifyReviewCycleSetup({
      tenantId: ar.tenantId,
      cycleId: ar.id,
      cycleName: ar.name,
      actorId: req.actor?.actorId,
    });
    const reviewTaskNotificationsCreated = await this.performanceNotificationService.notifyReviewAssignments({
      tenantId: ar.tenantId,
      cycleId: ar.id,
      cycleName: ar.name,
      assignments: reviewAssignments,
      actorId: req.actor?.actorId,
    });
    return this.mergeCommandResult(result, {
      notificationsCreated,
      reviewAssignmentsCreated: reviewAssignments.length,
      reviewTaskNotificationsCreated,
    });
  }

  @Post('review-cycles/:id/commands/activate')
  async activateReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    return this.executeCommand(this.buildCommand('ActivatePerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('review-cycles/:id/commands/start')
  async startReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    return this.executeCommand(this.buildCommand('StartPerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('review-cycles/:id/commands/enter-calibration')
  async enterCalibrationReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    return this.executeCommand(this.buildCommand('EnterCalibrationPerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('review-cycles/:id/commands/enter-review')
  async enterReviewReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    return this.executeCommand(this.buildCommand('EnterReviewPerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('review-cycles/:id/commands/close')
  async closeReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    return this.executeCommand(this.buildCommand('ClosePerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('review-cycles/tenant/:tenantId')
  async getReviewCyclesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    this.assertCanAccessTenant(req, tenantId);
    return this.cycleRepo.findByTenant(new Uuid(tenantId));
  }

  @Get('review-cycles/:id')
  async getReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const cycle = await this.cycleRepo.findById(new Uuid(id));
    if (!cycle) throw new NotFoundException('Review cycle not found');
    this.assertCanAccessTenant(req, cycle.tenantId.value);
    return cycle;
  }

  /* ═══════════════════════════════════════════════════════════════
     Performance Reviews
     ═══════════════════════════════════════════════════════════════ */
  @Post('reviews')
  async createReview(@Body(new ZodValidationPipe(CreatePerformanceReviewDtoSchema)) dto: dtos.CreatePerformanceReviewDto, @Req() req: Request) {
    return this.executeCommand(this.buildCommand('CreatePerformanceReview', 'PerformanceReview', dto, req, this.subjectWorkerId(dto.workerId)));
  }

  @Post('reviews/:id/commands/submit-self')
  async submitSelfReview(@Param('id') id: string, @Body(new ZodValidationPipe(SubmitSelfReviewDtoSchema)) dto: dtos.SubmitSelfReviewDto, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.executeCommand(this.buildCommand('SubmitSelfReview', 'PerformanceReview', { performanceReviewId: new Uuid(id), content: dto.content }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('reviews/:id/commands/submit-manager')
  async submitManagerReview(@Param('id') id: string, @Body(new ZodValidationPipe(SubmitManagerReviewDtoSchema)) dto: dtos.SubmitManagerReviewDto, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.executeCommand(this.buildCommand('SubmitManagerReview', 'PerformanceReview', { performanceReviewId: new Uuid(id), content: dto.content }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('reviews/:id/commands/calibrate')
  async calibrateReview(@Param('id') id: string, @Body(new ZodValidationPipe(CalibratePerformanceReviewDtoSchema)) dto: dtos.CalibratePerformanceReviewDto, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.executeCommand(this.buildCommand('CalibratePerformanceReview', 'PerformanceReview', { performanceReviewId: new Uuid(id), rating: dto.rating }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('reviews/:id/commands/finalize')
  async finalizeReview(@Param('id') id: string, @Body(new ZodValidationPipe(FinalizePerformanceReviewDtoSchema)) dto: dtos.FinalizePerformanceReviewDto, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.executeCommand(this.buildCommand('FinalizePerformanceReview', 'PerformanceReview', { performanceReviewId: new Uuid(id), rating: dto.rating }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('reviews/:id/commands/acknowledge')
  async acknowledgeReview(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.executeCommand(this.buildCommand('AcknowledgePerformanceReview', 'PerformanceReview', { performanceReviewId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('reviews/:id/commands/dispute')
  async disputeReview(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.executeCommand(this.buildCommand('DisputePerformanceReview', 'PerformanceReview', { performanceReviewId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('reviews/worker/:workerId')
  async getReviewsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId);
    return this.reviewRepo.findByWorker(new Uuid(workerId));
  }

  @Get('reviews/cycle/:cycleId')
  async getReviewsByCycle(@Param('cycleId') cycleId: string, @Req() req: Request) {
    const cycle = await this.cycleRepo.findById(new Uuid(cycleId));
    if (!cycle) throw new NotFoundException('Review cycle not found');
    this.assertCanAccessTenant(req, cycle.tenantId.value);
    return this.reviewRepo.findByReviewCycle(new Uuid(cycleId));
  }

  @Get('reviews/manager/:managerId')
  async getReviewsByManager(@Param('managerId') managerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, managerId);
    return this.reviewRepo.findByManager(new Uuid(managerId));
  }

  @Get('reviews/:id')
  async getReview(@Param('id') id: string, @Req() req: Request) {
    const review = await this.reviewRepo.findById(new Uuid(id));
    if (!review) throw new NotFoundException('Review not found');
    await this.assertCanAccessWorker(req, review.workerId.value);
    return review;
  }

  /* ═══════════════════════════════════════════════════════════════
     Goals
     ═══════════════════════════════════════════════════════════════ */
  @Post('goals')
  async createGoal(@Body(new ZodValidationPipe(CreateGoalDtoSchema)) dto: dtos.CreateGoalDto, @Req() req: Request) {
    return this.executeCommand(this.buildCommand('CreateGoal', 'Goal', dto, req, this.subjectWorkerId(dto.workerId)));
  }

  @Post('goals/:id/commands/activate')
  async activateGoal(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.goalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Goal not found');
    return this.executeCommand(this.buildCommand('ActivateGoal', 'Goal', { goalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('goals/:id/commands/update-progress')
  async updateGoalProgress(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateGoalProgressDtoSchema)) dto: dtos.UpdateGoalProgressDto, @Req() req: Request) {
    const ar = await this.goalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Goal not found');
    return this.executeCommand(this.buildCommand('UpdateGoalProgress', 'Goal', { goalId: new Uuid(id), currentValue: dto.currentValue }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('goals/:id/commands/mark-achieved')
  async markGoalAchieved(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.goalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Goal not found');
    return this.executeCommand(this.buildCommand('MarkGoalAchieved', 'Goal', { goalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('goals/:id/commands/mark-missed')
  async markGoalMissed(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.goalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Goal not found');
    return this.executeCommand(this.buildCommand('MarkGoalMissed', 'Goal', { goalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('goals/:id/commands/cancel')
  async cancelGoal(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.goalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Goal not found');
    return this.executeCommand(this.buildCommand('CancelGoal', 'Goal', { goalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('goals/worker/:workerId')
  async getGoalsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId);
    return this.goalRepo.findByWorker(new Uuid(workerId));
  }

  @Get('goals/:id')
  async getGoal(@Param('id') id: string, @Req() req: Request) {
    const goal = await this.goalRepo.findById(new Uuid(id));
    if (!goal) throw new NotFoundException('Goal not found');
    await this.assertCanAccessWorker(req, goal.workerId.value);
    return goal;
  }

  /* ═══════════════════════════════════════════════════════════════
     Calibration Sessions
     ═══════════════════════════════════════════════════════════════ */
  @Post('calibration-sessions')
  async createCalibrationSession(@Body(new ZodValidationPipe(CreateCalibrationSessionDtoSchema)) dto: dtos.CreateCalibrationSessionDto, @Req() req: Request) {
    return this.executeCommand(this.buildCommand('CreateCalibrationSession', 'CalibrationSession', dto, req));
  }

  @Post('calibration-sessions/:id/commands/schedule')
  async scheduleCalibrationSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.calibrationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Calibration session not found');
    return this.executeCommand(this.buildCommand('ScheduleCalibrationSession', 'CalibrationSession', { calibrationSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('calibration-sessions/:id/commands/start')
  async startCalibrationSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.calibrationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Calibration session not found');
    return this.executeCommand(this.buildCommand('StartCalibrationSession', 'CalibrationSession', { calibrationSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('calibration-sessions/:id/commands/complete')
  async completeCalibrationSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.calibrationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Calibration session not found');
    return this.executeCommand(this.buildCommand('CompleteCalibrationSession', 'CalibrationSession', { calibrationSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('calibration-sessions/:id/commands/finalize')
  async finalizeCalibrationSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.calibrationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Calibration session not found');
    return this.executeCommand(this.buildCommand('FinalizeCalibrationSession', 'CalibrationSession', { calibrationSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('calibration-sessions/cycle/:cycleId')
  async getCalibrationSessionsByCycle(@Param('cycleId') cycleId: string, @Req() req: Request) {
    const cycle = await this.cycleRepo.findById(new Uuid(cycleId));
    if (!cycle) throw new NotFoundException('Review cycle not found');
    this.assertCanAccessTenant(req, cycle.tenantId.value);
    return this.calibrationRepo.findByReviewCycle(new Uuid(cycleId));
  }

  @Get('calibration-sessions/:id')
  async getCalibrationSession(@Param('id') id: string, @Req() req: Request) {
    const session = await this.calibrationRepo.findById(new Uuid(id));
    if (!session) throw new NotFoundException('Calibration session not found');
    this.assertCanAccessTenant(req, session.tenantId.value);
    return session;
  }

  /* ═══════════════════════════════════════════════════════════════
     Performance Improvement Plans
     ═══════════════════════════════════════════════════════════════ */
  @Post('improvement-plans')
  async createPIP(@Body(new ZodValidationPipe(CreatePerformanceImprovementPlanDtoSchema)) dto: dtos.CreatePerformanceImprovementPlanDto, @Req() req: Request) {
    return this.executeCommand(this.buildCommand('CreatePerformanceImprovementPlan', 'PerformanceImprovementPlan', dto, req, this.subjectWorkerId(dto.workerId)));
  }

  @Post('improvement-plans/:id/commands/activate')
  async activatePIP(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    await this.assertCanAccessWorker(req, ar.workerId.value);
    return this.executeCommand(this.buildCommand('ActivatePerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion, subjectWorkerId: ar.workerId }));
  }

  @Post('improvement-plans/:id/commands/enter-review')
  async enterReviewPIP(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    await this.assertCanAccessWorker(req, ar.workerId.value);
    return this.executeCommand(this.buildCommand('EnterReviewPerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion, subjectWorkerId: ar.workerId }));
  }

  @Post('improvement-plans/:id/commands/complete')
  async completePIP(@Param('id') id: string, @Body(new ZodValidationPipe(CompletePerformanceImprovementPlanDtoSchema)) dto: dtos.CompletePerformanceImprovementPlanDto, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    await this.assertCanAccessWorker(req, ar.workerId.value);
    return this.executeCommand(this.buildCommand('CompletePerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id), outcome: dto.outcome }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion, subjectWorkerId: ar.workerId }));
  }

  @Post('improvement-plans/:id/commands/close')
  async closePIP(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    await this.assertCanAccessWorker(req, ar.workerId.value);
    return this.executeCommand(this.buildCommand('ClosePerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion, subjectWorkerId: ar.workerId }));
  }

  @Post('improvement-plans/:id/commands/extend')
  async extendPIP(@Param('id') id: string, @Body(new ZodValidationPipe(ExtendPerformanceImprovementPlanDtoSchema)) dto: dtos.ExtendPerformanceImprovementPlanDto, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    await this.assertCanAccessWorker(req, ar.workerId.value);
    return this.executeCommand(this.buildCommand('ExtendPerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id), newEndDate: dto.newEndDate }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion, subjectWorkerId: ar.workerId }));
  }

  @Post('improvement-plans/:id/commands/record-checkpoint')
  async recordPIPCheckpoint(@Param('id') id: string, @Body(new ZodValidationPipe(RecordPerformanceImprovementPlanCheckpointDtoSchema)) dto: dtos.RecordPerformanceImprovementPlanCheckpointDto, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    await this.assertCanAccessWorker(req, ar.workerId.value);
    return this.executeCommand(this.buildCommand('RecordPerformanceImprovementPlanCheckpoint', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id), ...dto }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion, subjectWorkerId: ar.workerId }));
  }

  @Post('improvement-plans/:id/commands/terminate')
  async terminatePIP(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    await this.assertCanAccessWorker(req, ar.workerId.value);
    return this.executeCommand(this.buildCommand('TerminatePerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion, subjectWorkerId: ar.workerId }));
  }

  @Get('improvement-plans/worker/:workerId')
  async getPIPsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId);
    return this.pipRepo.findByWorker(new Uuid(workerId));
  }

  @Get('improvement-plans/:id')
  async getPIP(@Param('id') id: string, @Req() req: Request) {
    const pip = await this.pipRepo.findById(new Uuid(id));
    if (!pip) throw new NotFoundException('Performance improvement plan not found');
    await this.assertCanAccessWorker(req, pip.workerId.value);
    return pip;
  }

  /* ═══════════════════════════════════════════════════════════════
     Feedback 360 Cycles
     ═══════════════════════════════════════════════════════════════ */
  @Post('feedback-360-cycles')
  async createFeedback360Cycle(@Body(new ZodValidationPipe(CreateFeedback360CycleDtoSchema)) dto: dtos.CreateFeedback360CycleDto, @Req() req: Request) {
    return this.executeCommand(this.buildCommand('CreatePerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', dto, req));
  }

  @Post('feedback-360-cycles/:id/commands/activate')
  async activateFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.feedback360CycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 cycle not found');
    return this.executeCommand(this.buildCommand('ActivatePerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', { feedback360CycleId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('feedback-360-cycles/:id/commands/launch')
  async launchFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.feedback360CycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 cycle not found');
    const result = await this.executeCommand(this.buildCommand('LaunchPerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', { feedback360CycleId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
    const activeWorkers = (await this.workerRepo.findActive()).filter((worker) => worker.tenantId.value === ar.tenantId.value);
    const existingResponses = await this.feedback360ResponseRepo.findByCycle(ar.id);
    const existingResponseKeys = new Set(existingResponses.map((response) => `${response.revieweeId.value}:${response.reviewerId.value}`));
    const maxPeerReviews = Math.max(1, ar.maxPeerReviews ?? 5);
    const minPeerReviews = Math.max(1, ar.minPeerReviews ?? 3);
    let feedbackRequestsCreated = 0;
    let feedbackNotificationsCreated = 0;
    const feedbackCoverageWarnings: string[] = [];

    for (const reviewee of activeWorkers) {
      const eligibleReviewers = activeWorkers
        .filter((candidate) => candidate.id.value !== reviewee.id.value)
        .map((candidate) => ({
          candidate,
          relationshipType: this.feedbackRelationshipType(reviewee, candidate),
        }))
        .filter((candidate) => Boolean(candidate.relationshipType))
        .slice(0, maxPeerReviews);

      if (eligibleReviewers.length < minPeerReviews) {
        feedbackCoverageWarnings.push(`${reviewee.id.value} has ${eligibleReviewers.length} eligible 360 reviewers; minimum is ${minPeerReviews}.`);
      }

      for (const { candidate, relationshipType } of eligibleReviewers) {
        const key = `${reviewee.id.value}:${candidate.id.value}`;
        if (existingResponseKeys.has(key)) continue;
        const createResponseResult = await this.executeCommand(this.buildCommand('CreatePerformanceFeedback360Response', 'PerformanceFeedback360Response', {
          cycleId: ar.id.value,
          revieweeId: reviewee.id.value,
          reviewerId: candidate.id.value,
          relationshipType,
          isAnonymous: ar.anonymityEnabled,
        }, req, { subjectWorkerId: reviewee.id }));
        const feedback360ResponseId = this.commandDataValue(createResponseResult, 'feedback360ResponseId');
        if (!feedback360ResponseId) continue;
        feedbackRequestsCreated += 1;
        existingResponseKeys.add(key);
        feedbackNotificationsCreated += await this.performanceNotificationService.notifyPeerReviewRequest({
          tenantId: ar.tenantId,
          cycleId: ar.id,
          cycleName: ar.name,
          revieweeId: reviewee.id,
          reviewerId: candidate.id,
          feedback360ResponseId,
          isAnonymous: ar.anonymityEnabled,
        });
      }
    }

    return this.mergeCommandResult(result, {
      feedbackRequestsCreated,
      feedbackNotificationsCreated,
      feedbackCoverageWarnings,
    });
  }

  @Post('feedback-360-cycles/:id/commands/close')
  async closeFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.feedback360CycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 cycle not found');
    return this.executeCommand(this.buildCommand('ClosePerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', { feedback360CycleId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('feedback-360-cycles/:id/commands/archive')
  async archiveFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.feedback360CycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 cycle not found');
    return this.executeCommand(this.buildCommand('ArchivePerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', { feedback360CycleId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('feedback-360-cycles/available')
  async getAvailableFeedback360Cycles(@Req() req: Request) {
    const tenantId = this.tenantIdFromRequest(req);
    const cycles = await this.feedback360CycleRepo.findByTenant(tenantId);
    return cycles.filter((cycle) => ['ACTIVE', 'IN_PROGRESS'].includes(cycle.status));
  }

  @Get('feedback-360-cycles/tenant/:tenantId')
  async getFeedback360CyclesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    this.assertCanAccessTenant(req, tenantId);
    return this.feedback360CycleRepo.findByTenant(new Uuid(tenantId));
  }

  @Get('feedback-360-cycles/:id')
  async getFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const cycle = await this.feedback360CycleRepo.findById(new Uuid(id));
    if (!cycle) throw new NotFoundException('Feedback 360 cycle not found');
    this.assertCanAccessTenant(req, cycle.tenantId.value);
    return cycle;
  }

  /* ═══════════════════════════════════════════════════════════════
     Feedback 360 Responses
     ═══════════════════════════════════════════════════════════════ */
  @Post('feedback-360-responses')
  async createFeedback360Response(@Body(new ZodValidationPipe(CreateFeedback360ResponseDtoSchema)) dto: dtos.CreateFeedback360ResponseDto, @Req() req: Request) {
    const cycle = await this.feedback360CycleRepo.findById(new Uuid(dto.cycleId));
    if (!cycle) throw new NotFoundException('Feedback 360 cycle not found');
    this.assertCanAccessTenant(req, cycle.tenantId.value);
    const result = await this.executeCommand(this.buildCommand('CreatePerformanceFeedback360Response', 'PerformanceFeedback360Response', dto, req, this.subjectWorkerId(dto.revieweeId)));
    const feedback360ResponseId = this.commandDataValue(result, 'feedback360ResponseId');
    const notificationsCreated = await this.performanceNotificationService.notifyPeerReviewRequest({
      tenantId: cycle.tenantId,
      cycleId: cycle.id,
      cycleName: cycle.name,
      revieweeId: new Uuid(dto.revieweeId),
      reviewerId: new Uuid(dto.reviewerId),
      feedback360ResponseId,
      isAnonymous: dto.isAnonymous ?? cycle.anonymityEnabled,
    });
    return this.mergeCommandResult(result, { notificationsCreated });
  }

  @Post('feedback-360-responses/self-service')
  async createSelfServiceFeedback(@Body(new ZodValidationPipe(CreateSelfServiceFeedbackDtoSchema)) dto: dtos.CreateSelfServiceFeedbackDto, @Req() req: Request) {
    const reviewer = await this.currentWorkerForRequest(req);
    const cycle = await this.feedback360CycleRepo.findById(new Uuid(dto.cycleId));
    if (!cycle) throw new NotFoundException('Feedback 360 cycle not found');
    const reviewee = await this.workerRepo.findById(new Uuid(dto.revieweeId));
    if (!reviewee) throw new NotFoundException('Reviewee not found');
    if (reviewee.id.value === reviewer.id.value) throw new BadRequestException('360 feedback must target another employee');
    await this.assertSelfServiceFeedbackEligibility(cycle, reviewer, reviewee, dto.relationshipType);

    const createResult = await this.executeCommand(this.buildCommand('CreatePerformanceFeedback360Response', 'PerformanceFeedback360Response', {
      cycleId: dto.cycleId,
      revieweeId: dto.revieweeId,
      reviewerId: reviewer.id.value,
      relationshipType: dto.relationshipType,
      isAnonymous: dto.isAnonymous ?? cycle.anonymityEnabled,
    }, req, { subjectWorkerId: reviewer.id }));
    const feedback360ResponseId = this.commandDataValue(createResult, 'feedback360ResponseId');
    if (!feedback360ResponseId) throw new BadRequestException('Feedback response was not created');
    const created = await this.feedback360ResponseRepo.findById(new Uuid(feedback360ResponseId));
    if (!created) throw new BadRequestException('Feedback response was not persisted');

    const submitResult = await this.executeCommand(this.buildCommand('SubmitPerformanceFeedback360Response', 'PerformanceFeedback360Response', {
      feedback360ResponseId,
      competencyScores: dto.competencyScores,
      dimensionScores: dto.dimensionScores,
      areaComments: dto.areaComments,
      overallRating: dto.overallRating,
      strengths: dto.strengths,
      improvements: dto.improvements,
      comments: dto.comments,
      isAnonymous: dto.isAnonymous ?? cycle.anonymityEnabled,
    }, req, {
      aggregateId: created.id,
      expectedState: created.status,
      expectedVersion: created.aggregateVersion,
      subjectWorkerId: reviewer.id,
    }));

    return this.mergeCommandResult(submitResult, { feedback360ResponseId, revieweeId: dto.revieweeId, reviewerId: reviewer.id.value });
  }

  @Post('feedback-360-responses/:id/commands/submit')
  async submitFeedback360Response(@Param('id') id: string, @Body(new ZodValidationPipe(SubmitFeedback360ResponseDtoSchema)) dto: dtos.SubmitFeedback360ResponseDto, @Req() req: Request) {
    const ar = await this.feedback360ResponseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 response not found');
    await this.assertCanSubmitFeedbackResponse(req, ar);
    return this.executeCommand(this.buildCommand('SubmitPerformanceFeedback360Response', 'PerformanceFeedback360Response', { feedback360ResponseId: id, ...dto }, req, {
      aggregateId: new Uuid(id),
      expectedState: ar.status,
      expectedVersion: ar.aggregateVersion,
      subjectWorkerId: ar.reviewerId,
    }));
  }

  @Get('feedback-360-responses/cycle/:cycleId')
  async getFeedback360ResponsesByCycle(@Param('cycleId') cycleId: string, @Req() req: Request) {
    const cycle = await this.feedback360CycleRepo.findById(new Uuid(cycleId));
    if (!cycle) throw new NotFoundException('Feedback 360 cycle not found');
    this.assertCanAccessTenant(req, cycle.tenantId.value);
    const responses = await this.feedback360ResponseRepo.findByCycle(new Uuid(cycleId));
    return responses.map((response) => this.presentFeedbackResponse(response, req));
  }

  @Get('feedback-360-responses/reviewee/:revieweeId')
  async getFeedback360ResponsesByReviewee(@Param('revieweeId') revieweeId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, revieweeId);
    const responses = await this.feedback360ResponseRepo.findByReviewee(new Uuid(revieweeId));
    return responses.map((response) => this.presentFeedbackResponse(response, req));
  }

  @Get('feedback-360-responses/reviewer/:reviewerId')
  async getFeedback360ResponsesByReviewer(@Param('reviewerId') reviewerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, reviewerId);
    const responses = await this.feedback360ResponseRepo.findByReviewer(new Uuid(reviewerId));
    return responses.map((response) => this.presentFeedbackResponse(response, req, reviewerId));
  }

  @Get('feedback-360-responses/:id')
  async getFeedback360Response(@Param('id') id: string, @Req() req: Request) {
    const response = await this.feedback360ResponseRepo.findById(new Uuid(id));
    if (!response) throw new NotFoundException('Feedback 360 response not found');
    await this.assertCanAccessFeedbackResponse(req, response);
    return this.presentFeedbackResponse(response, req);
  }

  /* ═══════════════════════════════════════════════════════════════
     Objectives (OKR)
     ═══════════════════════════════════════════════════════════════ */
  @Post('objectives')
  async createObjective(@Body(new ZodValidationPipe(CreateObjectiveDtoSchema)) dto: dtos.CreateObjectiveDto, @Req() req: Request) {
    return this.executeCommand(this.buildCommand('CreateObjective', 'Objective', dto, req, this.subjectWorkerId(dto.ownerId)));
  }

  @Post('objectives/:id/commands/activate')
  async activateObjective(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.objectiveRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Objective not found');
    return this.executeCommand(this.buildCommand('ActivateObjective', 'Objective', { objectiveId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('objectives/:id/commands/update-progress')
  async updateObjectiveProgress(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateObjectiveProgressDtoSchema)) dto: dtos.UpdateObjectiveProgressDto, @Req() req: Request) {
    const ar = await this.objectiveRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Objective not found');
    return this.executeCommand(this.buildCommand('UpdateObjectiveProgress', 'Objective', { objectiveId: id, progress: dto.progress, confidenceScore: dto.confidenceScore }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('objectives/:id/commands/mark-achieved')
  async markObjectiveAchieved(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.objectiveRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Objective not found');
    return this.executeCommand(this.buildCommand('MarkObjectiveAchieved', 'Objective', { objectiveId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('objectives/:id/commands/cancel')
  async cancelObjective(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.objectiveRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Objective not found');
    return this.executeCommand(this.buildCommand('CancelObjective', 'Objective', { objectiveId: id, reason: 'Cancelled via API' }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('objectives/owner/:ownerId')
  async getObjectivesByOwner(@Param('ownerId') ownerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, ownerId);
    return this.objectiveRepo.findByOwner(new Uuid(ownerId));
  }

  @Get('objectives/org-unit/:orgUnitId')
  async getObjectivesByOrgUnit(@Param('orgUnitId') orgUnitId: string, @Req() req: Request) {
    this.assertCanReadOrganizationalPerformance(req);
    return this.objectiveRepo.findByOrgUnit(new Uuid(orgUnitId));
  }

  @Get('objectives/parent/:parentObjectiveId')
  async getObjectivesByParent(@Param('parentObjectiveId') parentObjectiveId: string, @Req() req: Request) {
    this.assertCanReadOrganizationalPerformance(req);
    return this.objectiveRepo.findByParent(new Uuid(parentObjectiveId));
  }

  @Get('objectives/:id')
  async getObjective(@Param('id') id: string, @Req() req: Request) {
    const objective = await this.objectiveRepo.findById(new Uuid(id));
    if (!objective) throw new NotFoundException('Objective not found');
    await this.assertCanAccessWorker(req, objective.ownerId.value);
    return objective;
  }

  /* ═══════════════════════════════════════════════════════════════
     Key Results (OKR)
     ═══════════════════════════════════════════════════════════════ */
  @Post('key-results')
  async createKeyResult(@Body(new ZodValidationPipe(CreateKeyResultDtoSchema)) dto: dtos.CreateKeyResultDto, @Req() req: Request) {
    const objective = await this.objectiveRepo.findById(new Uuid(dto.objectiveId));
    if (!objective) throw new NotFoundException('Objective not found');
    await this.assertCanAccessWorker(req, objective.ownerId.value);
    return this.executeCommand(this.buildCommand('CreateKeyResult', 'KeyResult', dto, req, this.subjectWorkerId(objective.ownerId.value)));
  }

  @Post('key-results/:id/commands/activate')
  async activateKeyResult(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.keyResultRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Key result not found');
    return this.executeCommand(this.buildCommand('ActivateKeyResult', 'KeyResult', { keyResultId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('key-results/:id/commands/update-progress')
  async updateKeyResultProgress(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateKeyResultProgressDtoSchema)) dto: dtos.UpdateKeyResultProgressDto, @Req() req: Request) {
    const ar = await this.keyResultRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Key result not found');
    return this.executeCommand(this.buildCommand('UpdateKeyResultProgress', 'KeyResult', { keyResultId: id, currentValue: dto.currentValue }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('key-results/:id/commands/complete')
  async completeKeyResult(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.keyResultRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Key result not found');
    return this.executeCommand(this.buildCommand('CompleteKeyResult', 'KeyResult', { keyResultId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('key-results/:id/commands/cancel')
  async cancelKeyResult(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.keyResultRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Key result not found');
    return this.executeCommand(this.buildCommand('CancelKeyResult', 'KeyResult', { keyResultId: id, reason: 'Cancelled via API' }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('key-results/objective/:objectiveId')
  async getKeyResultsByObjective(@Param('objectiveId') objectiveId: string, @Req() req: Request) {
    const objective = await this.objectiveRepo.findById(new Uuid(objectiveId));
    if (!objective) throw new NotFoundException('Objective not found');
    await this.assertCanAccessWorker(req, objective.ownerId.value);
    return this.keyResultRepo.findByObjective(new Uuid(objectiveId));
  }

  @Get('key-results/:id')
  async getKeyResult(@Param('id') id: string, @Req() req: Request) {
    const keyResult = await this.keyResultRepo.findById(new Uuid(id));
    if (!keyResult) throw new NotFoundException('Key result not found');
    const objective = await this.objectiveRepo.findById(keyResult.objectiveId);
    if (objective) {
      await this.assertCanAccessWorker(req, objective.ownerId.value);
    } else {
      this.assertCanReadOrganizationalPerformance(req);
    }
    return keyResult;
  }

  /* ═══════════════════════════════════════════════════════════════
     KPIs
     ═══════════════════════════════════════════════════════════════ */
  @Post('kpis')
  async createKpi(@Body(new ZodValidationPipe(CreateKpiDtoSchema)) dto: dtos.CreateKpiDto, @Req() req: Request) {
    return this.executeCommand(this.buildCommand('CreateKpi', 'KeyPerformanceIndicator', dto, req, this.subjectWorkerId(dto.ownerId)));
  }

  @Post('kpis/:id/commands/activate')
  async activateKpi(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.kpiRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('KPI not found');
    return this.executeCommand(this.buildCommand('ActivateKpi', 'KeyPerformanceIndicator', { kpiId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('kpis/:id/commands/update-actual')
  async updateKpiActual(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateKpiActualDtoSchema)) dto: dtos.UpdateKpiActualDto, @Req() req: Request) {
    const ar = await this.kpiRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('KPI not found');
    return this.executeCommand(this.buildCommand('UpdateKpiActual', 'KeyPerformanceIndicator', { kpiId: id, actualValue: dto.actualValue }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('kpis/:id/commands/assign-owner')
  async assignKpiOwner(@Param('id') id: string, @Body(new ZodValidationPipe(AssignKpiOwnerDtoSchema)) dto: dtos.AssignKpiOwnerDto, @Req() req: Request) {
    const ar = await this.kpiRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('KPI not found');
    return this.executeCommand(this.buildCommand('AssignKpiOwner', 'KeyPerformanceIndicator', { kpiId: id, ownerId: dto.ownerId }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('kpis/:id/commands/archive')
  async archiveKpi(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.kpiRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('KPI not found');
    return this.executeCommand(this.buildCommand('ArchiveKpi', 'KeyPerformanceIndicator', { kpiId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('kpis/org-unit/:orgUnitId')
  async getKpisByOrgUnit(@Param('orgUnitId') orgUnitId: string, @Req() req: Request) {
    this.assertCanReadOrganizationalPerformance(req);
    return this.kpiRepo.findByOrgUnit(new Uuid(orgUnitId));
  }

  @Get('kpis/department/:category')
  async getKpisByDepartment(@Param('category') category: string, @Req() req: Request) {
    this.assertCanReadOrganizationalPerformance(req);
    return this.kpiRepo.findByDepartment(category);
  }

  @Get('kpis/:id')
  async getKpi(@Param('id') id: string, @Req() req: Request) {
    this.assertCanReadOrganizationalPerformance(req);
    const kpi = await this.kpiRepo.findById(new Uuid(id));
    if (!kpi) throw new NotFoundException('KPI not found');
    return kpi;
  }

  /* ═══════════════════════════════════════════════════════════════
     KPI Measurements
     ═══════════════════════════════════════════════════════════════ */
  @Post('kpi-measurements')
  async recordKpiMeasurement(@Body(new ZodValidationPipe(RecordKpiMeasurementDtoSchema)) dto: dtos.RecordKpiMeasurementDto, @Req() req: Request) {
    this.assertCanReadOrganizationalPerformance(req);
    const kpi = await this.kpiRepo.findById(new Uuid(dto.kpiId));
    if (!kpi) throw new NotFoundException('KPI not found');
    return this.executeCommand(this.buildCommand('RecordKpiMeasurement', 'KpiMeasurement', dto, req, this.subjectWorkerId(kpi.ownerId?.value)));
  }

  @Post('kpi-measurements/:id/commands/validate')
  async validateKpiMeasurement(@Param('id') id: string, @Body(new ZodValidationPipe(ValidateKpiMeasurementDtoSchema)) dto: dtos.ValidateKpiMeasurementDto, @Req() req: Request) {
    const ar = await this.kpiMeasurementRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('KPI measurement not found');
    return this.executeCommand(this.buildCommand('ValidateKpiMeasurement', 'KpiMeasurement', { kpiMeasurementId: id, validatedBy: dto.validatedBy }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('kpi-measurements/kpi/:kpiId')
  async getKpiMeasurementsByKpi(@Param('kpiId') kpiId: string, @Req() req: Request) {
    this.assertCanReadOrganizationalPerformance(req);
    return this.kpiMeasurementRepo.findByKpi(new Uuid(kpiId));
  }

  @Get('kpi-measurements/:id')
  async getKpiMeasurement(@Param('id') id: string, @Req() req: Request) {
    this.assertCanReadOrganizationalPerformance(req);
    const measurement = await this.kpiMeasurementRepo.findById(new Uuid(id));
    if (!measurement) throw new NotFoundException('KPI measurement not found');
    return measurement;
  }

  /* ═══════════════════════════════════════════════════════════════
     Review Templates
     ═══════════════════════════════════════════════════════════════ */
  @Post('review-templates')
  async createReviewTemplate(@Body(new ZodValidationPipe(CreateReviewTemplateDtoSchema)) dto: dtos.CreateReviewTemplateDto, @Req() req: Request) {
    return this.executeCommand(this.buildCommand('CreateReviewTemplate', 'ReviewTemplate', dto, req));
  }

  @Post('review-templates/:id/commands/publish')
  async publishReviewTemplate(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.reviewTemplateRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review template not found');
    return this.executeCommand(this.buildCommand('PublishReviewTemplate', 'ReviewTemplate', { reviewTemplateId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('review-templates/:id/commands/archive')
  async archiveReviewTemplate(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.reviewTemplateRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review template not found');
    return this.executeCommand(this.buildCommand('ArchiveReviewTemplate', 'ReviewTemplate', { reviewTemplateId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('review-templates/tenant/:tenantId')
  async getReviewTemplatesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    this.assertCanAccessTenant(req, tenantId);
    return this.reviewTemplateRepo.findByTenant(new Uuid(tenantId));
  }

  @Get('review-templates/:id')
  async getReviewTemplate(@Param('id') id: string, @Req() req: Request) {
    const template = await this.reviewTemplateRepo.findById(new Uuid(id));
    if (!template) throw new NotFoundException('Review template not found');
    this.assertCanAccessTenant(req, template.tenantId.value);
    return template;
  }

  /* ═══════════════════════════════════════════════════════════════
     Competencies
     ═══════════════════════════════════════════════════════════════ */
  @Post('competencies')
  async createCompetency(@Body(new ZodValidationPipe(CreateCompetencyDtoSchema)) dto: dtos.CreateCompetencyDto, @Req() req: Request) {
    return this.executeCommand(this.buildCommand('CreateCompetency', 'Competency', dto, req));
  }

  @Post('competencies/:id/commands/activate')
  async activateCompetency(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.competencyRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Competency not found');
    return this.executeCommand(this.buildCommand('ActivateCompetency', 'Competency', { competencyId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('competencies/:id/commands/deactivate')
  async deactivateCompetency(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.competencyRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Competency not found');
    return this.executeCommand(this.buildCommand('DeactivateCompetency', 'Competency', { competencyId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('competencies/category/:category')
  async getCompetenciesByCategory(@Param('category') category: string, @Req() req: Request) {
    this.assertCanReadOrganizationalPerformance(req);
    return this.competencyRepo.findByCategory(category);
  }

  @Get('competencies/tenant/:tenantId')
  async getCompetenciesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    this.assertCanAccessTenant(req, tenantId);
    return this.competencyRepo.findByTenant(new Uuid(tenantId));
  }

  @Get('competencies/:id')
  async getCompetency(@Param('id') id: string, @Req() req: Request) {
    const competency = await this.competencyRepo.findById(new Uuid(id));
    if (!competency) throw new NotFoundException('Competency not found');
    this.assertCanAccessTenant(req, competency.tenantId.value);
    return competency;
  }

  /* ═══════════════════════════════════════════════════════════════
     Development Plans
     ═══════════════════════════════════════════════════════════════ */
  @Post('development-plans')
  async createDevelopmentPlan(@Body(new ZodValidationPipe(CreateDevelopmentPlanDtoSchema)) dto: dtos.CreateDevelopmentPlanDto, @Req() req: Request) {
    return this.executeCommand(this.buildCommand('CreateDevelopmentPlan', 'DevelopmentPlan', dto, req, this.subjectWorkerId(dto.workerId)));
  }

  @Post('development-plans/:id/commands/activate')
  async activateDevelopmentPlan(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.developmentPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Development plan not found');
    return this.executeCommand(this.buildCommand('ActivateDevelopmentPlan', 'DevelopmentPlan', { developmentPlanId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('development-plans/:id/commands/record-milestone')
  async recordDevelopmentMilestone(@Param('id') id: string, @Body(new ZodValidationPipe(RecordDevelopmentMilestoneDtoSchema)) dto: dtos.RecordDevelopmentMilestoneDto, @Req() req: Request) {
    const ar = await this.developmentPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Development plan not found');
    return this.executeCommand(this.buildCommand('RecordDevelopmentMilestone', 'DevelopmentPlan', { developmentPlanId: id, objectiveTitle: dto.objectiveTitle, status: dto.status }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('development-plans/:id/commands/complete')
  async completeDevelopmentPlan(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.developmentPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Development plan not found');
    return this.executeCommand(this.buildCommand('CompleteDevelopmentPlan', 'DevelopmentPlan', { developmentPlanId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('development-plans/:id/commands/close')
  async closeDevelopmentPlan(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.developmentPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Development plan not found');
    return this.executeCommand(this.buildCommand('CloseDevelopmentPlan', 'DevelopmentPlan', { developmentPlanId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('development-plans/worker/:workerId')
  async getDevelopmentPlansByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId);
    return this.developmentPlanRepo.findByWorker(new Uuid(workerId));
  }

  @Get('development-plans/:id')
  async getDevelopmentPlan(@Param('id') id: string, @Req() req: Request) {
    const plan = await this.developmentPlanRepo.findById(new Uuid(id));
    if (!plan) throw new NotFoundException('Development plan not found');
    await this.assertCanAccessWorker(req, plan.workerId.value);
    return plan;
  }
}
