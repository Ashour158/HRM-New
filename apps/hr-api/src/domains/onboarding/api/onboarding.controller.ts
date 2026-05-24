import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  UsePipes,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Uuid } from '@hcm/shared-kernel';
import { createCommand } from '@hcm/command-contracts';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';

import { ZodValidationPipe } from '../../../pipes/zod-validation.pipe.js';
import { OnboardingPlanRepository } from '../repositories/onboarding-plan.repository.js';
import { OnboardingTaskRepository } from '../repositories/onboarding-task.repository.js';

import {
  CreateOnboardingPlanDto,
  CreateOnboardingTaskDto,
} from './dtos.js';

@ApiTags('Onboarding')
@Controller('hr/onboarding')
@UsePipes(ZodValidationPipe)
export class OnboardingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly planRepo: OnboardingPlanRepository,
    private readonly taskRepo: OnboardingTaskRepository,
  ) {}

  /* ── Plans ───────────────────────────────────────────────────── */

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
      expectedState: 'SCHEDULED',
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
  async listPlans(@Headers('x-tenant-id') tenantId: string) {
    // Return all plans for tenant by querying each status
    const draft = await this.planRepo.findByStatus('DRAFT');
    const scheduled = await this.planRepo.findByStatus('SCHEDULED');
    const inProgress = await this.planRepo.findByStatus('IN_PROGRESS');
    return [...draft, ...scheduled, ...inProgress].filter((p) => p.tenantId.value === tenantId);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get an onboarding plan by ID' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async getPlan(@Param('id') id: string) {
    const plan = await this.planRepo.findById(new Uuid(id));
    if (!plan) {
      throw new BadRequestException('Onboarding plan not found');
    }
    return {
      id: plan.id.value,
      workerId: plan.workerId.value,
      startDate: plan.startDate,
      status: plan.status,
      assignedBuddyId: plan.assignedBuddyId?.value,
      version: plan.aggregateVersion,
    };
  }

  @Get('plans/worker/:workerId')
  @ApiOperation({ summary: 'Get onboarding plan for a worker' })
  @ApiParam({ name: 'workerId', description: 'Worker UUID' })
  async getPlanByWorker(@Param('workerId') workerId: string) {
    const plan = await this.planRepo.findByWorker(new Uuid(workerId));
    if (!plan) {
      throw new BadRequestException('Onboarding plan not found for worker');
    }
    return {
      id: plan.id.value,
      workerId: plan.workerId.value,
      startDate: plan.startDate,
      status: plan.status,
      assignedBuddyId: plan.assignedBuddyId?.value,
      version: plan.aggregateVersion,
    };
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
      expectedState: 'IN_PROGRESS',
      reason: 'Complete onboarding task via API',
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
    return this.taskRepo.findByPlan(new Uuid(planId));
  }

  /* ── Helpers ─────────────────────────────────────────────────── */

  private buildCommand<TPayload>(
    commandName: string,
    tenantId: string,
    actorId: string,
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
        actorId: new Uuid(actorId),
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
