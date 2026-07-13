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
import { OffboardingPlanRepository } from '../repositories/offboarding-plan.repository.js';
import { OffboardingTaskRepository } from '../repositories/offboarding-task.repository.js';

import {
  CreateOffboardingPlanDto,
  CreateOffboardingTaskDto,
  ApplyOffboardingTemplateDto,
  RecordOffboardingTaskEvidenceDto,
} from './dtos.js';
import { OffboardingTemplateService } from '../services/offboarding-template.service.js';
import { OffboardingProgressService } from '../services/offboarding-progress.service.js';
import type { OffboardingPlan } from '../aggregates/offboarding-plan.aggregate.js';
import type { OffboardingTask } from '../aggregates/offboarding-task.aggregate.js';

const OFFBOARDING_ADMIN_ROLES = new Set(['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN', 'HRBP']);

@ApiTags('Offboarding')
@Controller('hr/offboarding')
@UseGuards(AuthGuard)
@UsePipes(ZodValidationPipe)
export class OffboardingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly planRepo: OffboardingPlanRepository,
    private readonly taskRepo: OffboardingTaskRepository,
    private readonly templates: OffboardingTemplateService,
    private readonly progress: OffboardingProgressService,
  ) {}

  /* ── Plans ───────────────────────────────────────────────────── */

  @Get('templates')
  @ApiOperation({ summary: 'List reason-based offboarding exit checklist templates' })
  async listTemplates(@Req() req: Request) {
    this.assertOffboardingAdminScope(req);
    return this.templates.listTemplates();
  }

  @Get('workbench')
  @ApiOperation({ summary: 'Get offboarding admin workbench with progress, checklists, and owner-group breakdown' })
  async getWorkbench(@Req() req: Request) {
    this.assertOffboardingAdminScope(req);
    const resolvedTenantId = this.resolveTenantId(req);
    const plans = await this.planRepo.findByTenant(new Uuid(resolvedTenantId));
    const allTasks = await this.taskRepo.findByTenant(new Uuid(resolvedTenantId));
    const planViews = plans.map((plan) => {
      const tasks = allTasks.filter((task) => task.offboardingPlanId.value === plan.id.value);
      return {
        ...this.toPlanView(plan),
        progress: this.progress.summarize(plan, tasks),
        tasks: tasks.map((task) => this.toTaskView(task)),
      };
    });

    return {
      plans: planViews,
      metrics: {
        activePlans: planViews.filter((plan) => ['DRAFT', 'ACTIVE'].includes(plan.status)).length,
        completedPlans: planViews.filter((plan) => plan.status === 'COMPLETED').length,
        overdueTasks: planViews.reduce((sum, plan) => sum + plan.progress.overdueTasks, 0),
        averageProgress: planViews.length === 0
          ? 0
          : Math.round(planViews.reduce((sum, plan) => sum + plan.progress.progressScore, 0) / planViews.length),
      },
    };
  }

  @Post('plans')
  @ApiOperation({ summary: 'Initiate a new offboarding plan for a departing worker' })
  async createPlan(
    @Body() dto: CreateOffboardingPlanDto,
    @Req() req: Request,
  ) {
    this.assertOffboardingAdminScope(req);
    const actor = requireActor(req, 'Offboarding');
    const envelope = this.buildCommand('CreateOffboardingPlan', {
      ...dto,
      initiatedBy: dto.initiatedBy ?? actor.actorId.value,
    }, {
      aggregateType: 'OffboardingPlan',
      reason: 'Initiate offboarding via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Post('plans/:id/commands/apply-template')
  @ApiOperation({ summary: 'Apply a reason-based exit checklist template to a plan' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async applyTemplate(
    @Param('id') id: string,
    @Body() dto: ApplyOffboardingTemplateDto,
    @Req() req: Request,
  ) {
    this.assertOffboardingAdminScope(req);
    const plan = await this.planRepo.findById(new Uuid(id));
    if (!plan) {
      throw new BadRequestException('Offboarding plan not found');
    }

    const template = this.templates.getTemplate(dto.trackCode);
    const taskPayloads = this.templates.materializeTasks(template, id, plan.lastWorkingDay, {
      workerId: plan.workerId.value,
      managerId: dto.managerId ?? plan.managerId?.value,
    });

    const createdTasks = [];
    for (const taskPayload of taskPayloads) {
      const envelope = this.buildCommand('CreateOffboardingTask', taskPayload, {
        aggregateType: 'OffboardingTask',
        reason: `Apply offboarding template ${template.code}`,
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
  @ApiOperation({ summary: 'Start an offboarding plan' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async startPlan(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.assertOffboardingAdminScope(req);
    const envelope = this.buildCommand('StartOffboarding', { planId: id }, {
      aggregateType: 'OffboardingPlan',
      aggregateId: id,
      expectedState: 'DRAFT',
      reason: 'Start offboarding via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Post('plans/:id/commands/complete')
  @ApiOperation({ summary: 'Complete an offboarding plan' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async completePlan(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.assertOffboardingAdminScope(req);
    const envelope = this.buildCommand('CompleteOffboarding', { planId: id }, {
      aggregateType: 'OffboardingPlan',
      aggregateId: id,
      expectedState: 'ACTIVE',
      reason: 'Complete offboarding via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Get('plans')
  @ApiOperation({ summary: 'List offboarding plans' })
  async listPlans(@Req() req: Request) {
    this.assertOffboardingAdminScope(req);
    const plans = await this.planRepo.findByTenant(new Uuid(this.resolveTenantId(req)));
    return plans.map((plan) => this.toPlanView(plan));
  }

  @Get('plans/by-id/:id')
  @ApiOperation({ summary: 'Get an offboarding plan by ID' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async getPlan(@Param('id') id: string, @Req() req: Request) {
    const plan = await this.planRepo.findById(new Uuid(id));
    if (!plan) {
      throw new BadRequestException('Offboarding plan not found');
    }
    this.assertCanAccessWorker(plan.workerId.value, req);
    return this.toPlanView(plan);
  }

  @Get('plans/worker/:workerId')
  @ApiOperation({ summary: 'Get the offboarding plan for a worker' })
  @ApiParam({ name: 'workerId', description: 'Worker UUID' })
  async getPlanByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertCanAccessWorker(workerId, req);
    const plan = await this.planRepo.findByWorker(new Uuid(workerId));
    if (!plan) {
      throw new BadRequestException('Offboarding plan not found for worker');
    }
    return this.toPlanView(plan);
  }

  /* ── Tasks ───────────────────────────────────────────────────── */

  @Post('tasks')
  @ApiOperation({ summary: 'Create an offboarding task' })
  async createTask(
    @Body() dto: CreateOffboardingTaskDto,
    @Req() req: Request,
  ) {
    this.assertOffboardingAdminScope(req);
    const envelope = this.buildCommand('CreateOffboardingTask', dto, {
      aggregateType: 'OffboardingTask',
      reason: 'Create offboarding task via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Post('tasks/:id/commands/complete')
  @ApiOperation({ summary: 'Complete an offboarding task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async completeTask(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.assertCanMutateTask(id, req);
    const envelope = this.buildCommand('CompleteOffboardingTask', { taskId: id }, {
      aggregateType: 'OffboardingTask',
      aggregateId: id,
      reason: 'Complete offboarding task via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Post('tasks/:id/evidence')
  @ApiOperation({ summary: 'Record offboarding task evidence: asset returned, final settlement confirmation, exit interview notes, etc.' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async recordTaskEvidence(
    @Param('id') id: string,
    @Body() dto: RecordOffboardingTaskEvidenceDto,
    @Req() req: Request,
  ) {
    await this.assertCanMutateTask(id, req);
    const envelope = this.buildCommand('RecordOffboardingTaskEvidence', { ...dto, taskId: id }, {
      aggregateType: 'OffboardingTask',
      aggregateId: id,
      reason: 'Record offboarding task evidence via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Post('tasks/:id/commands/skip')
  @ApiOperation({ summary: 'Skip an offboarding task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async skipTask(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.assertOffboardingAdminScope(req);
    const envelope = this.buildCommand('SkipOffboardingTask', { taskId: id }, {
      aggregateType: 'OffboardingTask',
      aggregateId: id,
      reason: 'Skip offboarding task via API',
    }, req);
    return this.commandBus.execute(envelope);
  }

  @Get('tasks/plan/:planId')
  @ApiOperation({ summary: 'Get tasks for an offboarding plan' })
  @ApiParam({ name: 'planId', description: 'Plan UUID' })
  async getTasksByPlan(@Param('planId') planId: string, @Req() req: Request) {
    if (!this.hasOffboardingAdminScope(req)) {
      const plan = await this.planRepo.findById(new Uuid(planId));
      if (!plan) throw new BadRequestException('Offboarding plan not found');
      this.assertCanAccessWorker(plan.workerId.value, req);
    }
    const tasks = await this.taskRepo.findByPlan(new Uuid(planId));
    return tasks.map((task) => this.toTaskView(task));
  }

  /* ── Helpers ─────────────────────────────────────────────────── */

  private toPlanView(plan: OffboardingPlan) {
    return {
      id: plan.id.value,
      workerId: plan.workerId.value,
      lastWorkingDay: plan.lastWorkingDay.toISOString(),
      status: plan.status,
      initiatedBy: plan.initiatedBy.value,
      reasonCategory: plan.reasonCategory,
      reasonNotes: plan.reasonNotes,
      managerId: plan.managerId?.value,
      version: plan.aggregateVersion,
    };
  }

  private resolveTenantId(req: Request): string {
    return requireTenantId(req, 'Offboarding').value;
  }

  private assertOffboardingAdminScope(req: Request): void {
    if (this.hasOffboardingAdminScope(req)) return;
    throw new ForbiddenException('Only HR administrators can access offboarding administration');
  }

  private hasOffboardingAdminScope(req?: Request): boolean {
    const roles = req?.actor?.roles ?? [];
    return roles.some((role) => OFFBOARDING_ADMIN_ROLES.has(role));
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }

  private assertCanAccessWorker(workerId: string, req: Request): void {
    if (this.hasOffboardingAdminScope(req)) return;
    if (this.getActorId(req) === workerId) return;
    throw new ForbiddenException('Employees can only access their own offboarding');
  }

  private async assertCanMutateTask(taskId: string, req: Request): Promise<void> {
    if (this.hasOffboardingAdminScope(req)) return;
    const task = await this.taskRepo.findById(new Uuid(taskId));
    if (!task) throw new BadRequestException('Offboarding task not found');

    const actorId = this.getActorId(req);
    if (task.assignedTo?.value === actorId) return;

    const plan = await this.planRepo.findById(task.offboardingPlanId);
    if (plan?.workerId.value === actorId) return;

    throw new ForbiddenException('Employees can only update their own offboarding tasks');
  }

  private toTaskView(task: OffboardingTask) {
    return {
      id: task.id.value,
      offboardingPlanId: task.offboardingPlanId.value,
      planId: task.offboardingPlanId.value,
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo?.value,
      ownerGroup: task.ownerGroup,
      category: task.category,
      required: task.required,
      evidenceType: task.evidenceType,
      evidencePayload: task.evidencePayload,
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
    const actor = requireActor(req, 'Offboarding');
    return createCommand(
      commandName,
      requireTenantId(req, 'Offboarding'),
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
