import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
  UsePipes,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Uuid } from '@hcm/shared-kernel';
import { createCommand } from '@hcm/command-contracts';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { Request } from 'express';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { requireActor, requireTenantId } from '../../../platform/http/request-context.js';

import { ZodValidationPipe } from '../../../pipes/zod-validation.pipe.js';
import { OnboardingPlanRepository } from '../repositories/onboarding-plan.repository.js';
import { OnboardingTaskRepository } from '../repositories/onboarding-task.repository.js';

import {
  CreateOnboardingPlanDto,
  CreateOnboardingTaskDto,
  ApplyOnboardingTemplateDto,
  RecordOnboardingTaskEvidenceDto,
} from './dtos.js';
import { OnboardingTemplateService } from '../services/onboarding-template.service.js';
import { OnboardingReadinessService } from '../services/onboarding-readiness.service.js';
import type { OnboardingPlan } from '../aggregates/onboarding-plan.aggregate.js';
import type { OnboardingTask } from '../aggregates/onboarding-task.aggregate.js';

const ONBOARDING_ADMIN_ROLES = new Set(['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN', 'HRBP', 'TALENT_ADMIN']);

@ApiTags('Onboarding')
@Controller('hr/onboarding')
@UseGuards(AuthGuard)
@UsePipes(ZodValidationPipe)
export class OnboardingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly planRepo: OnboardingPlanRepository,
    private readonly taskRepo: OnboardingTaskRepository,
    private readonly templates: OnboardingTemplateService,
    private readonly readiness: OnboardingReadinessService,
  ) {}

  /* ── Plans ───────────────────────────────────────────────────── */

  @Get('templates')
  @ApiOperation({ summary: 'List role-based onboarding track templates' })
  async listTemplates(@Req() req: Request) {
    this.assertOnboardingAdminScope(req);
    return this.templates.listTemplates();
  }

  @Get('workbench')
  @ApiOperation({ summary: 'Get onboarding admin workbench with readiness, checklists, and owner-group progress' })
  async getWorkbench(@Req() req: Request) {
    this.assertOnboardingAdminScope(req);
    const resolvedTenantId = this.resolveTenantId(req);
    const plans = await this.planRepo.findByTenant(new Uuid(resolvedTenantId));
    const allTasks = await this.taskRepo.findByTenant(new Uuid(resolvedTenantId));
    const planViews = plans.map((plan) => {
      const tasks = allTasks.filter((task) => task.onboardingPlanId.value === plan.id.value);
      return {
        ...this.toPlanView(plan),
        readiness: this.readiness.summarize(plan, tasks),
        tasks: tasks.map((task) => this.toTaskView(task)),
      };
    });

    return {
      plans: planViews,
      metrics: {
        activePlans: planViews.filter((plan) => ['DRAFT', 'SCHEDULED', 'IN_PROGRESS'].includes(plan.status)).length,
        invitedPreboarding: planViews.filter((plan) => plan.preboardingPortalStatus !== 'NOT_INVITED').length,
        overdueTasks: planViews.reduce((sum, plan) => sum + plan.readiness.overdueTasks, 0),
        averageReadiness: planViews.length === 0
          ? 0
          : Math.round(planViews.reduce((sum, plan) => sum + plan.readiness.readinessScore, 0) / planViews.length),
      },
    };
  }

  @Post('plans')
  @ApiOperation({ summary: 'Create a new onboarding plan' })
  async createPlan(
    @Body() dto: CreateOnboardingPlanDto,
    @Req() req: Request,
  ) {
    this.assertOnboardingAdminScope(req);
    const envelope = this.buildCommand('CreateOnboardingPlan', dto, {
      aggregateType: 'OnboardingPlan',
      reason: 'Create onboarding plan via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Post('plans/:id/commands/apply-template')
  @ApiOperation({ summary: 'Apply a role-based onboarding checklist template to a plan' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async applyTemplate(
    @Param('id') id: string,
    @Body() dto: ApplyOnboardingTemplateDto,
    @Req() req: Request,
  ) {
    this.assertOnboardingAdminScope(req);
    const plan = await this.planRepo.findById(new Uuid(id));
    if (!plan) {
      throw new BadRequestException('Onboarding plan not found');
    }

    const template = this.templates.getTemplate(dto.trackCode);
    const taskPayloads = this.templates.materializeTasks(template, id, plan.startDate, {
      managerId: dto.managerId,
      assignedBuddyId: dto.assignedBuddyId ?? plan.assignedBuddyId?.value,
      mentorId: dto.mentorId ?? plan.mentorId?.value,
    });

    const createdTasks = [];
    for (const taskPayload of taskPayloads) {
      const envelope = this.buildCommand('CreateOnboardingTask', taskPayload, {
        aggregateType: 'OnboardingTask',
        reason: `Apply onboarding template ${template.code}`,
      }, req);
      createdTasks.push(await this.commandBus.execute(envelope));
    }

    return {
      plan: this.toPlanView(plan),
      template,
      createdTaskCount: createdTasks.length,
      createdTasks,
    };
  }

  @Post('plans/:id/commands/start')
  @ApiOperation({ summary: 'Start an onboarding plan' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async startPlan(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.assertOnboardingAdminScope(req);
    const envelope = this.buildCommand('StartOnboarding', { planId: id }, {
      aggregateType: 'OnboardingPlan',
      aggregateId: id,
      reason: 'Start onboarding via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Post('plans/:id/commands/complete')
  @ApiOperation({ summary: 'Complete an onboarding plan' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async completePlan(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.assertOnboardingAdminScope(req);
    const envelope = this.buildCommand('CompleteOnboarding', { planId: id }, {
      aggregateType: 'OnboardingPlan',
      aggregateId: id,
      expectedState: 'IN_PROGRESS',
      reason: 'Complete onboarding via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Get('plans')
  @ApiOperation({ summary: 'List onboarding plans' })
  async listPlans(@Req() req: Request) {
    this.assertOnboardingAdminScope(req);
    const plans = await this.planRepo.findByTenant(new Uuid(this.resolveTenantId(req)));
    return plans.map((plan) => this.toPlanView(plan));
  }

  @Get('plans/by-id/:id')
  @ApiOperation({ summary: 'Get an onboarding plan by ID' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async getPlan(@Param('id') id: string, @Req() req: Request) {
    const plan = await this.planRepo.findById(new Uuid(id));
    if (!plan) {
      throw new BadRequestException('Onboarding plan not found');
    }
    this.assertCanAccessWorker(plan.workerId.value, req);
    return this.toPlanView(plan);
  }

  @Get('plans/worker/:workerId')
  @ApiOperation({ summary: 'Get onboarding plan for a worker' })
  @ApiParam({ name: 'workerId', description: 'Worker UUID' })
  async getPlanByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertCanAccessWorker(workerId, req);
    const plan = await this.planRepo.findByWorker(new Uuid(workerId));
    if (!plan) {
      throw new BadRequestException('Onboarding plan not found for worker');
    }
    return this.toPlanView(plan);
  }

  /* ── Tasks ───────────────────────────────────────────────────── */

  @Post('tasks')
  @ApiOperation({ summary: 'Create an onboarding task' })
  async createTask(
    @Body() dto: CreateOnboardingTaskDto,
    @Req() req: Request,
  ) {
    this.assertOnboardingAdminScope(req);
    const envelope = this.buildCommand('CreateOnboardingTask', dto, {
      aggregateType: 'OnboardingTask',
      reason: 'Create onboarding task via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Post('tasks/:id/commands/complete')
  @ApiOperation({ summary: 'Complete an onboarding task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async completeTask(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.assertCanMutateTask(id, req);
    const envelope = this.buildCommand('CompleteOnboardingTask', { taskId: id }, {
      aggregateType: 'OnboardingTask',
      aggregateId: id,
      reason: 'Complete onboarding task via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Post('tasks/:id/evidence')
  @ApiOperation({ summary: 'Record onboarding task evidence for signing, upload, provisioning, compliance, or probation' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async recordTaskEvidence(
    @Param('id') id: string,
    @Body() dto: RecordOnboardingTaskEvidenceDto,
    @Req() req: Request,
  ) {
    await this.assertCanMutateTask(id, req);
    const envelope = this.buildCommand('RecordOnboardingTaskEvidence', { ...dto, taskId: id }, {
      aggregateType: 'OnboardingTask',
      aggregateId: id,
      reason: 'Record onboarding task evidence via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Post('tasks/:id/commands/skip')
  @ApiOperation({ summary: 'Skip an onboarding task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async skipTask(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.assertOnboardingAdminScope(req);
    const envelope = this.buildCommand('SkipOnboardingTask', { taskId: id }, {
      aggregateType: 'OnboardingTask',
      aggregateId: id,
      reason: 'Skip onboarding task via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Get('tasks/plan/:planId')
  @ApiOperation({ summary: 'Get tasks for an onboarding plan' })
  @ApiParam({ name: 'planId', description: 'Plan UUID' })
  async getTasksByPlan(@Param('planId') planId: string, @Req() req: Request) {
    if (!this.hasOnboardingAdminScope(req)) {
      const plan = await this.planRepo.findById(new Uuid(planId));
      if (!plan) throw new BadRequestException('Onboarding plan not found');
      this.assertCanAccessWorker(plan.workerId.value, req);
    }
    const tasks = await this.taskRepo.findByPlan(new Uuid(planId));
    return tasks.map((task) => this.toTaskView(task));
  }

  /* ── Helpers ─────────────────────────────────────────────────── */

  private toPlanView(plan: OnboardingPlan) {
    return {
      id: plan.id.value,
      workerId: plan.workerId.value,
      startDate: plan.startDate.toISOString(),
      status: plan.status,
      assignedBuddyId: plan.assignedBuddyId?.value,
      mentorId: plan.mentorId?.value,
      roleTrack: plan.roleTrack,
      preboardingPortalStatus: plan.preboardingPortalStatus,
      firstDayInstructions: plan.firstDayInstructions,
      welcomeMessage: plan.welcomeMessage,
      probationReviewDate: plan.probationReviewDate?.toISOString(),
      probationStatus: plan.probationStatus,
      version: plan.aggregateVersion,
    };
  }

  private resolveTenantId(req: Request): string {
    return requireTenantId(req, 'Onboarding').value;
  }

  private assertOnboardingAdminScope(req: Request): void {
    if (this.hasOnboardingAdminScope(req)) return;
    throw new ForbiddenException('Only HR or talent administrators can access onboarding administration');
  }

  private hasOnboardingAdminScope(req?: Request): boolean {
    const roles = req?.actor?.roles ?? [];
    return roles.some((role) => ONBOARDING_ADMIN_ROLES.has(role));
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }

  private assertCanAccessWorker(workerId: string, req: Request): void {
    if (this.hasOnboardingAdminScope(req)) return;
    if (this.getActorId(req) === workerId) return;
    throw new ForbiddenException('Employees can only access their own onboarding');
  }

  private async assertCanMutateTask(taskId: string, req: Request): Promise<void> {
    if (this.hasOnboardingAdminScope(req)) return;
    const task = await this.taskRepo.findById(new Uuid(taskId));
    if (!task) throw new BadRequestException('Onboarding task not found');

    const actorId = this.getActorId(req);
    if (task.assignedTo?.value === actorId) return;

    const plan = await this.planRepo.findById(task.onboardingPlanId);
    if (plan?.workerId.value === actorId) return;

    throw new ForbiddenException('Employees can only update their own onboarding tasks');
  }

  private toTaskView(task: OnboardingTask) {
    return {
      id: task.id.value,
      onboardingPlanId: task.onboardingPlanId.value,
      planId: task.onboardingPlanId.value,
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo?.value,
      ownerGroup: task.ownerGroup,
      category: task.category,
      required: task.required,
      evidenceType: task.evidenceType,
      evidencePayload: task.evidencePayload,
      provisioningTarget: task.provisioningTarget,
      signingProviderEnvelopeId: task.signingProviderEnvelopeId,
      milestoneDay: task.milestoneDay,
      completionNotes: task.completionNotes,
      dueDate: task.dueDate?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
      status: task.status,
      version: task.aggregateVersion,
    };
  }

  private buildCommand<TPayload>(
    commandName: string,
    payload: TPayload,
    options: {
      aggregateType: string;
      aggregateId?: string;
      expectedState?: string;
      reason?: string;
    },
    req: Request,
  ): HrCommandEnvelope<TPayload> {
    const actor = requireActor(req, 'Onboarding');
    return createCommand(
      commandName,
      requireTenantId(req, 'Onboarding'),
      actor,
      payload,
      {
        aggregateType: options.aggregateType,
        aggregateId: options.aggregateId ? new Uuid(options.aggregateId) : undefined,
        expectedState: options.expectedState,
        idempotencyKey: crypto.randomUUID(),
        correlationId: Uuid.generate(),
        reason: options.reason ?? 'API request',
      },
    );
  }
}
