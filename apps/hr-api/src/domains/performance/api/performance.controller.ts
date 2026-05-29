import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';

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

import type * as dtos from './dtos.js';
import {
  // Existing
  CreatePerformanceReviewCycleDtoSchema, CreatePerformanceReviewDtoSchema,
  SubmitSelfReviewDtoSchema, SubmitManagerReviewDtoSchema,
  CalibratePerformanceReviewDtoSchema, FinalizePerformanceReviewDtoSchema,
  CreateGoalDtoSchema, UpdateGoalProgressDtoSchema,
  CreateCalibrationSessionDtoSchema,
  CreatePerformanceImprovementPlanDtoSchema, CompletePerformanceImprovementPlanDtoSchema, ExtendPerformanceImprovementPlanDtoSchema,
  // New
  CreateFeedback360CycleDtoSchema, CreateFeedback360ResponseDtoSchema, SubmitFeedback360ResponseDtoSchema,
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
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: { actorType: 'USER', actorId: Uuid.generate(), roles: ['HR_ADMIN'], permissions: ['PERFORMANCE_WRITE'], mfaAuthenticated: true },
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: 'HR_ADMIN' },
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     Performance Review Cycles
     ═══════════════════════════════════════════════════════════════ */
  @Post('review-cycles')
  async createReviewCycle(@Body(new ZodValidationPipe(CreatePerformanceReviewCycleDtoSchema)) dto: dtos.CreatePerformanceReviewCycleDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreatePerformanceReviewCycle', 'PerformanceReviewCycle', dto, req));
  }

  @Post('review-cycles/:id/commands/setup')
  async setupReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    return this.commandBus.execute(this.buildCommand('SetupPerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('review-cycles/:id/commands/activate')
  async activateReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    return this.commandBus.execute(this.buildCommand('ActivatePerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('review-cycles/:id/commands/start')
  async startReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    return this.commandBus.execute(this.buildCommand('StartPerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('review-cycles/:id/commands/enter-calibration')
  async enterCalibrationReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    return this.commandBus.execute(this.buildCommand('EnterCalibrationPerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('review-cycles/:id/commands/enter-review')
  async enterReviewReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    return this.commandBus.execute(this.buildCommand('EnterReviewPerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('review-cycles/:id/commands/close')
  async closeReviewCycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review cycle not found');
    return this.commandBus.execute(this.buildCommand('ClosePerformanceReviewCycle', 'PerformanceReviewCycle', { performanceReviewCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('review-cycles/:id')
  async getReviewCycle(@Param('id') id: string) { return this.cycleRepo.findById(new Uuid(id)); }

  @Get('review-cycles/tenant/:tenantId')
  async getReviewCyclesByTenant(@Param('tenantId') tenantId: string) { return this.cycleRepo.findByTenant(new Uuid(tenantId)); }

  /* ═══════════════════════════════════════════════════════════════
     Performance Reviews
     ═══════════════════════════════════════════════════════════════ */
  @Post('reviews')
  async createReview(@Body(new ZodValidationPipe(CreatePerformanceReviewDtoSchema)) dto: dtos.CreatePerformanceReviewDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreatePerformanceReview', 'PerformanceReview', dto, req));
  }

  @Post('reviews/:id/commands/submit-self')
  async submitSelfReview(@Param('id') id: string, @Body(new ZodValidationPipe(SubmitSelfReviewDtoSchema)) dto: dtos.SubmitSelfReviewDto, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.commandBus.execute(this.buildCommand('SubmitSelfReview', 'PerformanceReview', { performanceReviewId: new Uuid(id), content: dto.content }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('reviews/:id/commands/submit-manager')
  async submitManagerReview(@Param('id') id: string, @Body(new ZodValidationPipe(SubmitManagerReviewDtoSchema)) dto: dtos.SubmitManagerReviewDto, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.commandBus.execute(this.buildCommand('SubmitManagerReview', 'PerformanceReview', { performanceReviewId: new Uuid(id), content: dto.content }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('reviews/:id/commands/calibrate')
  async calibrateReview(@Param('id') id: string, @Body(new ZodValidationPipe(CalibratePerformanceReviewDtoSchema)) dto: dtos.CalibratePerformanceReviewDto, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.commandBus.execute(this.buildCommand('CalibratePerformanceReview', 'PerformanceReview', { performanceReviewId: new Uuid(id), rating: dto.rating }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('reviews/:id/commands/finalize')
  async finalizeReview(@Param('id') id: string, @Body(new ZodValidationPipe(FinalizePerformanceReviewDtoSchema)) dto: dtos.FinalizePerformanceReviewDto, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.commandBus.execute(this.buildCommand('FinalizePerformanceReview', 'PerformanceReview', { performanceReviewId: new Uuid(id), rating: dto.rating }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('reviews/:id/commands/acknowledge')
  async acknowledgeReview(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.commandBus.execute(this.buildCommand('AcknowledgePerformanceReview', 'PerformanceReview', { performanceReviewId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('reviews/:id/commands/dispute')
  async disputeReview(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.reviewRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review not found');
    return this.commandBus.execute(this.buildCommand('DisputePerformanceReview', 'PerformanceReview', { performanceReviewId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('reviews/:id')
  async getReview(@Param('id') id: string) { return this.reviewRepo.findById(new Uuid(id)); }

  @Get('reviews/worker/:workerId')
  async getReviewsByWorker(@Param('workerId') workerId: string) { return this.reviewRepo.findByWorker(new Uuid(workerId)); }

  @Get('reviews/cycle/:cycleId')
  async getReviewsByCycle(@Param('cycleId') cycleId: string) { return this.reviewRepo.findByReviewCycle(new Uuid(cycleId)); }

  /* ═══════════════════════════════════════════════════════════════
     Goals
     ═══════════════════════════════════════════════════════════════ */
  @Post('goals')
  async createGoal(@Body(new ZodValidationPipe(CreateGoalDtoSchema)) dto: dtos.CreateGoalDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateGoal', 'Goal', dto, req));
  }

  @Post('goals/:id/commands/activate')
  async activateGoal(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.goalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Goal not found');
    return this.commandBus.execute(this.buildCommand('ActivateGoal', 'Goal', { goalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('goals/:id/commands/update-progress')
  async updateGoalProgress(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateGoalProgressDtoSchema)) dto: dtos.UpdateGoalProgressDto, @Req() req: Request) {
    const ar = await this.goalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Goal not found');
    return this.commandBus.execute(this.buildCommand('UpdateGoalProgress', 'Goal', { goalId: new Uuid(id), currentValue: dto.currentValue }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('goals/:id/commands/mark-achieved')
  async markGoalAchieved(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.goalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Goal not found');
    return this.commandBus.execute(this.buildCommand('MarkGoalAchieved', 'Goal', { goalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('goals/:id/commands/mark-missed')
  async markGoalMissed(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.goalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Goal not found');
    return this.commandBus.execute(this.buildCommand('MarkGoalMissed', 'Goal', { goalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('goals/:id/commands/cancel')
  async cancelGoal(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.goalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Goal not found');
    return this.commandBus.execute(this.buildCommand('CancelGoal', 'Goal', { goalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('goals/:id')
  async getGoal(@Param('id') id: string) { return this.goalRepo.findById(new Uuid(id)); }

  @Get('goals/worker/:workerId')
  async getGoalsByWorker(@Param('workerId') workerId: string) { return this.goalRepo.findByWorker(new Uuid(workerId)); }

  /* ═══════════════════════════════════════════════════════════════
     Calibration Sessions
     ═══════════════════════════════════════════════════════════════ */
  @Post('calibration-sessions')
  async createCalibrationSession(@Body(new ZodValidationPipe(CreateCalibrationSessionDtoSchema)) dto: dtos.CreateCalibrationSessionDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateCalibrationSession', 'CalibrationSession', dto, req));
  }

  @Post('calibration-sessions/:id/commands/schedule')
  async scheduleCalibrationSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.calibrationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Calibration session not found');
    return this.commandBus.execute(this.buildCommand('ScheduleCalibrationSession', 'CalibrationSession', { calibrationSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('calibration-sessions/:id/commands/start')
  async startCalibrationSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.calibrationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Calibration session not found');
    return this.commandBus.execute(this.buildCommand('StartCalibrationSession', 'CalibrationSession', { calibrationSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('calibration-sessions/:id/commands/complete')
  async completeCalibrationSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.calibrationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Calibration session not found');
    return this.commandBus.execute(this.buildCommand('CompleteCalibrationSession', 'CalibrationSession', { calibrationSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('calibration-sessions/:id/commands/finalize')
  async finalizeCalibrationSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.calibrationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Calibration session not found');
    return this.commandBus.execute(this.buildCommand('FinalizeCalibrationSession', 'CalibrationSession', { calibrationSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('calibration-sessions/:id')
  async getCalibrationSession(@Param('id') id: string) { return this.calibrationRepo.findById(new Uuid(id)); }

  @Get('calibration-sessions/cycle/:cycleId')
  async getCalibrationSessionsByCycle(@Param('cycleId') cycleId: string) { return this.calibrationRepo.findByReviewCycle(new Uuid(cycleId)); }

  /* ═══════════════════════════════════════════════════════════════
     Performance Improvement Plans
     ═══════════════════════════════════════════════════════════════ */
  @Post('improvement-plans')
  async createPIP(@Body(new ZodValidationPipe(CreatePerformanceImprovementPlanDtoSchema)) dto: dtos.CreatePerformanceImprovementPlanDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreatePerformanceImprovementPlan', 'PerformanceImprovementPlan', dto, req));
  }

  @Post('improvement-plans/:id/commands/activate')
  async activatePIP(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    return this.commandBus.execute(this.buildCommand('ActivatePerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('improvement-plans/:id/commands/enter-review')
  async enterReviewPIP(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    return this.commandBus.execute(this.buildCommand('EnterReviewPerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('improvement-plans/:id/commands/complete')
  async completePIP(@Param('id') id: string, @Body(new ZodValidationPipe(CompletePerformanceImprovementPlanDtoSchema)) dto: dtos.CompletePerformanceImprovementPlanDto, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    return this.commandBus.execute(this.buildCommand('CompletePerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id), outcome: dto.outcome }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('improvement-plans/:id/commands/close')
  async closePIP(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    return this.commandBus.execute(this.buildCommand('ClosePerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('improvement-plans/:id/commands/extend')
  async extendPIP(@Param('id') id: string, @Body(new ZodValidationPipe(ExtendPerformanceImprovementPlanDtoSchema)) dto: dtos.ExtendPerformanceImprovementPlanDto, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    return this.commandBus.execute(this.buildCommand('ExtendPerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id), newEndDate: dto.newEndDate }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('improvement-plans/:id/commands/terminate')
  async terminatePIP(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.pipRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('PIP not found');
    return this.commandBus.execute(this.buildCommand('TerminatePerformanceImprovementPlan', 'PerformanceImprovementPlan', { performanceImprovementPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('improvement-plans/:id')
  async getPIP(@Param('id') id: string) { return this.pipRepo.findById(new Uuid(id)); }

  @Get('improvement-plans/worker/:workerId')
  async getPIPsByWorker(@Param('workerId') workerId: string) { return this.pipRepo.findByWorker(new Uuid(workerId)); }

  /* ═══════════════════════════════════════════════════════════════
     Feedback 360 Cycles
     ═══════════════════════════════════════════════════════════════ */
  @Post('feedback-360-cycles')
  async createFeedback360Cycle(@Body(new ZodValidationPipe(CreateFeedback360CycleDtoSchema)) dto: dtos.CreateFeedback360CycleDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreatePerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', dto, req));
  }

  @Post('feedback-360-cycles/:id/commands/activate')
  async activateFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.feedback360CycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 cycle not found');
    return this.commandBus.execute(this.buildCommand('ActivatePerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', { feedback360CycleId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('feedback-360-cycles/:id/commands/launch')
  async launchFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.feedback360CycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 cycle not found');
    return this.commandBus.execute(this.buildCommand('LaunchPerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', { feedback360CycleId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('feedback-360-cycles/:id/commands/close')
  async closeFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.feedback360CycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 cycle not found');
    return this.commandBus.execute(this.buildCommand('ClosePerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', { feedback360CycleId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('feedback-360-cycles/:id/commands/archive')
  async archiveFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.feedback360CycleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 cycle not found');
    return this.commandBus.execute(this.buildCommand('ArchivePerformanceFeedback360Cycle', 'PerformanceFeedback360Cycle', { feedback360CycleId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('feedback-360-cycles/:id')
  async getFeedback360Cycle(@Param('id') id: string) { return this.feedback360CycleRepo.findById(new Uuid(id)); }

  @Get('feedback-360-cycles/tenant/:tenantId')
  async getFeedback360CyclesByTenant(@Param('tenantId') tenantId: string) { return this.feedback360CycleRepo.findByTenant(new Uuid(tenantId)); }

  /* ═══════════════════════════════════════════════════════════════
     Feedback 360 Responses
     ═══════════════════════════════════════════════════════════════ */
  @Post('feedback-360-responses')
  async createFeedback360Response(@Body(new ZodValidationPipe(CreateFeedback360ResponseDtoSchema)) dto: dtos.CreateFeedback360ResponseDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreatePerformanceFeedback360Response', 'PerformanceFeedback360Response', dto, req));
  }

  @Post('feedback-360-responses/:id/commands/submit')
  async submitFeedback360Response(@Param('id') id: string, @Body(new ZodValidationPipe(SubmitFeedback360ResponseDtoSchema)) dto: dtos.SubmitFeedback360ResponseDto, @Req() req: Request) {
    const ar = await this.feedback360ResponseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 response not found');
    return this.commandBus.execute(this.buildCommand('SubmitPerformanceFeedback360Response', 'PerformanceFeedback360Response', { feedback360ResponseId: id, ...dto }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('feedback-360-responses/:id')
  async getFeedback360Response(@Param('id') id: string) { return this.feedback360ResponseRepo.findById(new Uuid(id)); }

  @Get('feedback-360-responses/cycle/:cycleId')
  async getFeedback360ResponsesByCycle(@Param('cycleId') cycleId: string) { return this.feedback360ResponseRepo.findByCycle(new Uuid(cycleId)); }

  @Get('feedback-360-responses/reviewee/:revieweeId')
  async getFeedback360ResponsesByReviewee(@Param('revieweeId') revieweeId: string) { return this.feedback360ResponseRepo.findByReviewee(new Uuid(revieweeId)); }

  /* ═══════════════════════════════════════════════════════════════
     Objectives (OKR)
     ═══════════════════════════════════════════════════════════════ */
  @Post('objectives')
  async createObjective(@Body(new ZodValidationPipe(CreateObjectiveDtoSchema)) dto: dtos.CreateObjectiveDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateObjective', 'Objective', dto, req));
  }

  @Post('objectives/:id/commands/activate')
  async activateObjective(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.objectiveRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Objective not found');
    return this.commandBus.execute(this.buildCommand('ActivateObjective', 'Objective', { objectiveId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('objectives/:id/commands/update-progress')
  async updateObjectiveProgress(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateObjectiveProgressDtoSchema)) dto: dtos.UpdateObjectiveProgressDto, @Req() req: Request) {
    const ar = await this.objectiveRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Objective not found');
    return this.commandBus.execute(this.buildCommand('UpdateObjectiveProgress', 'Objective', { objectiveId: id, progress: dto.progress, confidenceScore: dto.confidenceScore }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('objectives/:id/commands/mark-achieved')
  async markObjectiveAchieved(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.objectiveRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Objective not found');
    return this.commandBus.execute(this.buildCommand('MarkObjectiveAchieved', 'Objective', { objectiveId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('objectives/:id/commands/cancel')
  async cancelObjective(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.objectiveRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Objective not found');
    return this.commandBus.execute(this.buildCommand('CancelObjective', 'Objective', { objectiveId: id, reason: 'Cancelled via API' }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('objectives/:id')
  async getObjective(@Param('id') id: string) { return this.objectiveRepo.findById(new Uuid(id)); }

  @Get('objectives/owner/:ownerId')
  async getObjectivesByOwner(@Param('ownerId') ownerId: string) { return this.objectiveRepo.findByOwner(new Uuid(ownerId)); }

  @Get('objectives/org-unit/:orgUnitId')
  async getObjectivesByOrgUnit(@Param('orgUnitId') orgUnitId: string) { return this.objectiveRepo.findByOrgUnit(new Uuid(orgUnitId)); }

  @Get('objectives/parent/:parentObjectiveId')
  async getObjectivesByParent(@Param('parentObjectiveId') parentObjectiveId: string) { return this.objectiveRepo.findByReviewCycle(new Uuid(parentObjectiveId)); }

  /* ═══════════════════════════════════════════════════════════════
     Key Results (OKR)
     ═══════════════════════════════════════════════════════════════ */
  @Post('key-results')
  async createKeyResult(@Body(new ZodValidationPipe(CreateKeyResultDtoSchema)) dto: dtos.CreateKeyResultDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateKeyResult', 'KeyResult', dto, req));
  }

  @Post('key-results/:id/commands/activate')
  async activateKeyResult(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.keyResultRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Key result not found');
    return this.commandBus.execute(this.buildCommand('ActivateKeyResult', 'KeyResult', { keyResultId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('key-results/:id/commands/update-progress')
  async updateKeyResultProgress(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateKeyResultProgressDtoSchema)) dto: dtos.UpdateKeyResultProgressDto, @Req() req: Request) {
    const ar = await this.keyResultRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Key result not found');
    return this.commandBus.execute(this.buildCommand('UpdateKeyResultProgress', 'KeyResult', { keyResultId: id, currentValue: dto.currentValue }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('key-results/:id/commands/complete')
  async completeKeyResult(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.keyResultRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Key result not found');
    return this.commandBus.execute(this.buildCommand('CompleteKeyResult', 'KeyResult', { keyResultId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('key-results/:id/commands/cancel')
  async cancelKeyResult(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.keyResultRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Key result not found');
    return this.commandBus.execute(this.buildCommand('CancelKeyResult', 'KeyResult', { keyResultId: id, reason: 'Cancelled via API' }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('key-results/:id')
  async getKeyResult(@Param('id') id: string) { return this.keyResultRepo.findById(new Uuid(id)); }

  @Get('key-results/objective/:objectiveId')
  async getKeyResultsByObjective(@Param('objectiveId') objectiveId: string) { return this.keyResultRepo.findByObjective(new Uuid(objectiveId)); }

  /* ═══════════════════════════════════════════════════════════════
     KPIs
     ═══════════════════════════════════════════════════════════════ */
  @Post('kpis')
  async createKpi(@Body(new ZodValidationPipe(CreateKpiDtoSchema)) dto: dtos.CreateKpiDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateKpi', 'KeyPerformanceIndicator', dto, req));
  }

  @Post('kpis/:id/commands/activate')
  async activateKpi(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.kpiRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('KPI not found');
    return this.commandBus.execute(this.buildCommand('ActivateKpi', 'KeyPerformanceIndicator', { kpiId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('kpis/:id/commands/update-actual')
  async updateKpiActual(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateKpiActualDtoSchema)) dto: dtos.UpdateKpiActualDto, @Req() req: Request) {
    const ar = await this.kpiRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('KPI not found');
    return this.commandBus.execute(this.buildCommand('UpdateKpiActual', 'KeyPerformanceIndicator', { kpiId: id, actualValue: dto.actualValue }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('kpis/:id/commands/assign-owner')
  async assignKpiOwner(@Param('id') id: string, @Body(new ZodValidationPipe(AssignKpiOwnerDtoSchema)) dto: dtos.AssignKpiOwnerDto, @Req() req: Request) {
    const ar = await this.kpiRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('KPI not found');
    return this.commandBus.execute(this.buildCommand('AssignKpiOwner', 'KeyPerformanceIndicator', { kpiId: id, ownerId: dto.ownerId }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('kpis/:id/commands/archive')
  async archiveKpi(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.kpiRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('KPI not found');
    return this.commandBus.execute(this.buildCommand('ArchiveKpi', 'KeyPerformanceIndicator', { kpiId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('kpis/:id')
  async getKpi(@Param('id') id: string) { return this.kpiRepo.findById(new Uuid(id)); }

  @Get('kpis/org-unit/:orgUnitId')
  async getKpisByOrgUnit(@Param('orgUnitId') orgUnitId: string) { return this.kpiRepo.findByOrgUnit(new Uuid(orgUnitId)); }

  @Get('kpis/department/:category')
  async getKpisByDepartment(@Param('category') category: string) { return this.kpiRepo.findByDepartment(category); }

  /* ═══════════════════════════════════════════════════════════════
     KPI Measurements
     ═══════════════════════════════════════════════════════════════ */
  @Post('kpi-measurements')
  async recordKpiMeasurement(@Body(new ZodValidationPipe(RecordKpiMeasurementDtoSchema)) dto: dtos.RecordKpiMeasurementDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('RecordKpiMeasurement', 'KpiMeasurement', dto, req));
  }

  @Post('kpi-measurements/:id/commands/validate')
  async validateKpiMeasurement(@Param('id') id: string, @Body(new ZodValidationPipe(ValidateKpiMeasurementDtoSchema)) dto: dtos.ValidateKpiMeasurementDto, @Req() req: Request) {
    const ar = await this.kpiMeasurementRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('KPI measurement not found');
    return this.commandBus.execute(this.buildCommand('ValidateKpiMeasurement', 'KpiMeasurement', { kpiMeasurementId: id, validatedBy: dto.validatedBy }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('kpi-measurements/:id')
  async getKpiMeasurement(@Param('id') id: string) { return this.kpiMeasurementRepo.findById(new Uuid(id)); }

  @Get('kpi-measurements/kpi/:kpiId')
  async getKpiMeasurementsByKpi(@Param('kpiId') kpiId: string) { return this.kpiMeasurementRepo.findByKpi(new Uuid(kpiId)); }

  /* ═══════════════════════════════════════════════════════════════
     Review Templates
     ═══════════════════════════════════════════════════════════════ */
  @Post('review-templates')
  async createReviewTemplate(@Body(new ZodValidationPipe(CreateReviewTemplateDtoSchema)) dto: dtos.CreateReviewTemplateDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateReviewTemplate', 'ReviewTemplate', dto, req));
  }

  @Post('review-templates/:id/commands/publish')
  async publishReviewTemplate(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.reviewTemplateRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review template not found');
    return this.commandBus.execute(this.buildCommand('PublishReviewTemplate', 'ReviewTemplate', { reviewTemplateId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('review-templates/:id/commands/archive')
  async archiveReviewTemplate(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.reviewTemplateRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Review template not found');
    return this.commandBus.execute(this.buildCommand('ArchiveReviewTemplate', 'ReviewTemplate', { reviewTemplateId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('review-templates/:id')
  async getReviewTemplate(@Param('id') id: string) { return this.reviewTemplateRepo.findById(new Uuid(id)); }

  @Get('review-templates/tenant/:tenantId')
  async getReviewTemplatesByTenant(@Param('tenantId') tenantId: string) { return this.reviewTemplateRepo.findByTenant(new Uuid(tenantId)); }

  /* ═══════════════════════════════════════════════════════════════
     Competencies
     ═══════════════════════════════════════════════════════════════ */
  @Post('competencies')
  async createCompetency(@Body(new ZodValidationPipe(CreateCompetencyDtoSchema)) dto: dtos.CreateCompetencyDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateCompetency', 'Competency', dto, req));
  }

  @Post('competencies/:id/commands/activate')
  async activateCompetency(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.competencyRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Competency not found');
    return this.commandBus.execute(this.buildCommand('ActivateCompetency', 'Competency', { competencyId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('competencies/:id/commands/deactivate')
  async deactivateCompetency(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.competencyRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Competency not found');
    return this.commandBus.execute(this.buildCommand('DeactivateCompetency', 'Competency', { competencyId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('competencies/:id')
  async getCompetency(@Param('id') id: string) { return this.competencyRepo.findById(new Uuid(id)); }

  @Get('competencies/category/:category')
  async getCompetenciesByCategory(@Param('category') category: string) { return this.competencyRepo.findByCategory(category); }

  @Get('competencies/tenant/:tenantId')
  async getCompetenciesByTenant(@Param('tenantId') tenantId: string) { return this.competencyRepo.findByTenant(new Uuid(tenantId)); }

  /* ═══════════════════════════════════════════════════════════════
     Development Plans
     ═══════════════════════════════════════════════════════════════ */
  @Post('development-plans')
  async createDevelopmentPlan(@Body(new ZodValidationPipe(CreateDevelopmentPlanDtoSchema)) dto: dtos.CreateDevelopmentPlanDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateDevelopmentPlan', 'DevelopmentPlan', dto, req));
  }

  @Post('development-plans/:id/commands/activate')
  async activateDevelopmentPlan(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.developmentPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Development plan not found');
    return this.commandBus.execute(this.buildCommand('ActivateDevelopmentPlan', 'DevelopmentPlan', { developmentPlanId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('development-plans/:id/commands/record-milestone')
  async recordDevelopmentMilestone(@Param('id') id: string, @Body(new ZodValidationPipe(RecordDevelopmentMilestoneDtoSchema)) dto: dtos.RecordDevelopmentMilestoneDto, @Req() req: Request) {
    const ar = await this.developmentPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Development plan not found');
    return this.commandBus.execute(this.buildCommand('RecordDevelopmentMilestone', 'DevelopmentPlan', { developmentPlanId: id, objectiveTitle: dto.objectiveTitle, status: dto.status }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('development-plans/:id/commands/complete')
  async completeDevelopmentPlan(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.developmentPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Development plan not found');
    return this.commandBus.execute(this.buildCommand('CompleteDevelopmentPlan', 'DevelopmentPlan', { developmentPlanId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('development-plans/:id/commands/close')
  async closeDevelopmentPlan(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.developmentPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Development plan not found');
    return this.commandBus.execute(this.buildCommand('CloseDevelopmentPlan', 'DevelopmentPlan', { developmentPlanId: id }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('development-plans/:id')
  async getDevelopmentPlan(@Param('id') id: string) { return this.developmentPlanRepo.findById(new Uuid(id)); }

  @Get('development-plans/worker/:workerId')
  async getDevelopmentPlansByWorker(@Param('workerId') workerId: string) { return this.developmentPlanRepo.findByWorker(new Uuid(workerId)); }
}
