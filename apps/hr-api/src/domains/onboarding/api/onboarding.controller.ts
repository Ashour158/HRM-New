import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
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
  async listTemplates(@Req() req?: Request) {
    this.assertOnboardingAdminScope(req);
    return this.templates.listTemplates();
  }

  @Get('workbench')
  @ApiOperation({ summary: 'Get onboarding admin workbench with readiness, checklists, and owner-group progress' })
  async getWorkbench(@Headers('x-tenant-id') tenantId: string, @Req() req?: Request) {
    this.assertOnboardingAdminScope(req);
    const resolvedTenantId = this.resolveTenantId(tenantId, req);
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
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('CreateOnboardingPlan', tenantId, actorId, roles, dto, {
      aggregateType: 'OnboardingPlan',
      reason: 'Create onboarding plan via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('plans/:id/commands/apply-template')
  @ApiOperation({ summary: 'Apply a role-based onboarding checklist template to a plan' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async applyTemplate(
    @Param('id') id: string,
    @Body() dto: ApplyOnboardingTemplateDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const plan = await this.planRepo.findById(new Uuid(id));
    if (!plan) {
      throw new BadRequestException('Onboarding plan not found');
    }

    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const template = this.templates.getTemplate(dto.trackCode);
    const taskPayloads = this.templates.materializeTasks(template, id, plan.startDate, {
      managerId: dto.managerId,
      assignedBuddyId: dto.assignedBuddyId ?? plan.assignedBuddyId?.value,
      mentorId: dto.mentorId ?? plan.mentorId?.value,
    });

    const createdTasks = [];
    for (const taskPayload of taskPayloads) {
      const envelope = this.buildCommand('CreateOnboardingTask', tenantId, actorId, roles, taskPayload, {
        aggregateType: 'OnboardingTask',
        reason: `Apply onboarding template ${template.code}`,
      });
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
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('StartOnboarding', tenantId, actorId, roles, { planId: id }, {
      aggregateType: 'OnboardingPlan',
      aggregateId: id,
      reason: 'Start onboarding via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('plans/:id/commands/complete')
  @ApiOperation({ summary: 'Complete an onboarding plan' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async completePlan(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('CompleteOnboarding', tenantId, actorId, roles, { planId: id }, {
      aggregateType: 'OnboardingPlan',
      aggregateId: id,
      expectedState: 'IN_PROGRESS',
      reason: 'Complete onboarding via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Get('plans')
  @ApiOperation({ summary: 'List onboarding plans' })
  async listPlans(@Headers('x-tenant-id') tenantId: string, @Req() req?: Request) {
    this.assertOnboardingAdminScope(req);
    const plans = await this.planRepo.findByTenant(new Uuid(this.resolveTenantId(tenantId, req)));
    return plans.map((plan) => this.toPlanView(plan));
  }

  @Get('plans/by-id/:id')
  @ApiOperation({ summary: 'Get an onboarding plan by ID' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async getPlan(@Param('id') id: string) {
    const plan = await this.planRepo.findById(new Uuid(id));
    if (!plan) {
      throw new BadRequestException('Onboarding plan not found');
    }
    return this.toPlanView(plan);
  }

  @Get('plans/worker/:workerId')
  @ApiOperation({ summary: 'Get onboarding plan for a worker' })
  @ApiParam({ name: 'workerId', description: 'Worker UUID' })
  async getPlanByWorker(@Param('workerId') workerId: string) {
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
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('CreateOnboardingTask', tenantId, actorId, roles, dto, {
      aggregateType: 'OnboardingTask',
      reason: 'Create onboarding task via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('tasks/:id/commands/complete')
  @ApiOperation({ summary: 'Complete an onboarding task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async completeTask(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('CompleteOnboardingTask', tenantId, actorId, roles, { taskId: id }, {
      aggregateType: 'OnboardingTask',
      aggregateId: id,
      reason: 'Complete onboarding task via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('tasks/:id/evidence')
  @ApiOperation({ summary: 'Record onboarding task evidence for signing, upload, provisioning, compliance, or probation' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async recordTaskEvidence(
    @Param('id') id: string,
    @Body() dto: RecordOnboardingTaskEvidenceDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('RecordOnboardingTaskEvidence', tenantId, actorId, roles, { ...dto, taskId: id }, {
      aggregateType: 'OnboardingTask',
      aggregateId: id,
      reason: 'Record onboarding task evidence via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('tasks/:id/commands/skip')
  @ApiOperation({ summary: 'Skip an onboarding task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async skipTask(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('SkipOnboardingTask', tenantId, actorId, roles, { taskId: id }, {
      aggregateType: 'OnboardingTask',
      aggregateId: id,
      reason: 'Skip onboarding task via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Get('tasks/plan/:planId')
  @ApiOperation({ summary: 'Get tasks for an onboarding plan' })
  @ApiParam({ name: 'planId', description: 'Plan UUID' })
  async getTasksByPlan(@Param('planId') planId: string) {
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

  private resolveTenantId(headerTenantId: string | undefined, req?: Request): string {
    const tenantId = req?.tenantId ?? headerTenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    return tenantId;
  }

  private assertOnboardingAdminScope(req?: Request): void {
    if (!req) return;
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => ONBOARDING_ADMIN_ROLES.has(role))) return;
    throw new ForbiddenException('Only HR or talent administrators can access onboarding administration');
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
    tenantId: string,
    actorId: string | undefined,
    roles: string[],
    payload: TPayload,
    options: {
      aggregateType: string;
      aggregateId?: string;
      expectedState?: string;
      reason?: string;
    },
  ): HrCommandEnvelope<TPayload> {
    return createCommand(
      commandName,
      new Uuid(tenantId),
      {
        actorType: 'USER',
        actorId: new Uuid(actorId ?? '00000000-0000-0000-0000-000000000010'),
        roles,
        permissions: roles,
        mfaAuthenticated: true,
      },
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
