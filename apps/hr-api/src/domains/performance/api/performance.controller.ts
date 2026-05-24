import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { PerformanceReviewCycleRepository } from '../repositories/performance-review-cycle.repository.js';
import { PerformanceReviewRepository } from '../repositories/performance-review.repository.js';
import { GoalRepository } from '../repositories/goal.repository.js';
import { CalibrationSessionRepository } from '../repositories/calibration-session.repository.js';
import { PerformanceImprovementPlanRepository } from '../repositories/performance-improvement-plan.repository.js';
import type * as dtos from './dtos.js';
import {
  CreatePerformanceReviewCycleDtoSchema, CreatePerformanceReviewDtoSchema,
  SubmitSelfReviewDtoSchema, SubmitManagerReviewDtoSchema,
  CalibratePerformanceReviewDtoSchema, FinalizePerformanceReviewDtoSchema,
  CreateGoalDtoSchema, UpdateGoalProgressDtoSchema,
  CreateCalibrationSessionDtoSchema,
  CreatePerformanceImprovementPlanDtoSchema, CompletePerformanceImprovementPlanDtoSchema, ExtendPerformanceImprovementPlanDtoSchema,
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
      actor: { actorType: 'SYSTEM', actorId: Uuid.generate(), roles: ['HR_ADMIN'], permissions: ['PERFORMANCE_WRITE'], mfaAuthenticated: true },
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

  /* Performance Review Cycles */
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
  async getReviewCycle(@Param('id') id: string) {
    return this.cycleRepo.findById(new Uuid(id));
  }

  @Get('review-cycles/tenant/:tenantId')
  async getReviewCyclesByTenant(@Param('tenantId') tenantId: string) {
    return this.cycleRepo.findByTenant(new Uuid(tenantId));
  }

  /* Performance Reviews */
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
  async getReview(@Param('id') id: string) {
    return this.reviewRepo.findById(new Uuid(id));
  }

  @Get('reviews/worker/:workerId')
  async getReviewsByWorker(@Param('workerId') workerId: string) {
    return this.reviewRepo.findByWorker(new Uuid(workerId));
  }

  @Get('reviews/cycle/:cycleId')
  async getReviewsByCycle(@Param('cycleId') cycleId: string) {
    return this.reviewRepo.findByReviewCycle(new Uuid(cycleId));
  }

  /* Goals */
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
  async getGoal(@Param('id') id: string) {
    return this.goalRepo.findById(new Uuid(id));
  }

  @Get('goals/worker/:workerId')
  async getGoalsByWorker(@Param('workerId') workerId: string) {
    return this.goalRepo.findByWorker(new Uuid(workerId));
  }

  /* Calibration Sessions */
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
  async getCalibrationSession(@Param('id') id: string) {
    return this.calibrationRepo.findById(new Uuid(id));
  }

  @Get('calibration-sessions/cycle/:cycleId')
  async getCalibrationSessionsByCycle(@Param('cycleId') cycleId: string) {
    return this.calibrationRepo.findByReviewCycle(new Uuid(cycleId));
  }

  /* Performance Improvement Plans */
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
  async getPIP(@Param('id') id: string) {
    return this.pipRepo.findById(new Uuid(id));
  }

  @Get('improvement-plans/worker/:workerId')
  async getPIPsByWorker(@Param('workerId') workerId: string) {
    return this.pipRepo.findByWorker(new Uuid(workerId));
  }
}
