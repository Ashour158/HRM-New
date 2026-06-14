import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { SkillProfileRepository } from '../repositories/skill-profile.repository.js';
import { TalentPoolRepository } from '../repositories/talent-pool.repository.js';
import { CareerPathRepository } from '../repositories/career-path.repository.js';
import { SuccessionPlanRepository } from '../repositories/succession-plan.repository.js';
import type * as dtos from './dtos.js';
import {
  CreateSkillProfileDtoSchema, UpdateSkillProfileDtoSchema, ValidateSkillProfileDtoSchema,
  CreateTalentPoolDtoSchema, UpdateTalentPoolDtoSchema, AddTalentPoolMemberDtoSchema,
  CreateCareerPathDtoSchema, AchieveCareerPathMilestoneDtoSchema,
  CreateSuccessionPlanDtoSchema, UpdateSuccessionReadinessDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

@ApiTags('Skills & Talent')
@Controller('skills-talent')
export class SkillsTalentController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly skillProfileRepo: SkillProfileRepository,
    private readonly talentPoolRepo: TalentPoolRepository,
    private readonly careerPathRepo: CareerPathRepository,
    private readonly successionPlanRepo: SuccessionPlanRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = requireTenantId(req, 'Skills and Talent');
    const actor = requireActor(req, 'Skills and Talent');
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
      metadata: { requestHash: computeRequestHash(payload), clientType: actorClientType(actor) },
    };
  }

  private requireMatchingTenant(req: Request, tenantId: string): Uuid {
    const requestTenantId = requireTenantId(req, 'Skills and Talent');
    if (requestTenantId.value !== tenantId) {
      throw new BadRequestException('Tenant mismatch');
    }
    return requestTenantId;
  }

  /* Skill Profiles */
  @Post('skill-profiles')
  async createSkillProfile(@Body(new ZodValidationPipe(CreateSkillProfileDtoSchema)) dto: dtos.CreateSkillProfileDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateSkillProfile', 'SkillProfile', dto, req));
  }

  @Post('skill-profiles/:id/commands/update')
  async updateSkillProfile(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateSkillProfileDtoSchema)) dto: dtos.UpdateSkillProfileDto, @Req() req: Request) {
    const ar = await this.skillProfileRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Skill profile not found');
    return this.commandBus.execute(this.buildCommand('UpdateSkillProfile', 'SkillProfile', { skillProfileId: new Uuid(id), skills: dto.skills }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('skill-profiles/:id/commands/validate')
  async validateSkillProfile(@Param('id') id: string, @Body(new ZodValidationPipe(ValidateSkillProfileDtoSchema)) dto: dtos.ValidateSkillProfileDto, @Req() req: Request) {
    const ar = await this.skillProfileRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Skill profile not found');
    return this.commandBus.execute(this.buildCommand('ValidateSkillProfile', 'SkillProfile', { skillProfileId: new Uuid(id), validatedBy: new Uuid(dto.validatedBy) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('skill-profiles/:id/commands/archive')
  async archiveSkillProfile(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.skillProfileRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Skill profile not found');
    return this.commandBus.execute(this.buildCommand('ArchiveSkillProfile', 'SkillProfile', { skillProfileId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('skill-profiles/:id')
  async getSkillProfile(@Param('id') id: string) {
    return this.skillProfileRepo.findById(new Uuid(id));
  }

  @Get('skill-profiles/worker/:workerId')
  async getSkillProfileByWorker(@Param('workerId') workerId: string) {
    return this.skillProfileRepo.findByWorker(new Uuid(workerId));
  }

  @Get('skill-profiles/tenant/:tenantId')
  async getSkillProfilesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.skillProfileRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  /* Talent Pools */
  @Post('talent-pools')
  async createTalentPool(@Body(new ZodValidationPipe(CreateTalentPoolDtoSchema)) dto: dtos.CreateTalentPoolDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateTalentPool', 'TalentPool', dto, req));
  }

  @Post('talent-pools/:id/commands/update')
  async updateTalentPool(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateTalentPoolDtoSchema)) dto: dtos.UpdateTalentPoolDto, @Req() req: Request) {
    const ar = await this.talentPoolRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Talent pool not found');
    return this.commandBus.execute(this.buildCommand('UpdateTalentPool', 'TalentPool', { talentPoolId: new Uuid(id), criteria: dto.criteria }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('talent-pools/:id/commands/add-member')
  async addTalentPoolMember(@Param('id') id: string, @Body(new ZodValidationPipe(AddTalentPoolMemberDtoSchema)) dto: dtos.AddTalentPoolMemberDto, @Req() req: Request) {
    const ar = await this.talentPoolRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Talent pool not found');
    return this.commandBus.execute(this.buildCommand('AddTalentPoolMember', 'TalentPool', { talentPoolId: new Uuid(id), memberId: dto.memberId }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('talent-pools/:id/commands/remove-member')
  async removeTalentPoolMember(@Param('id') id: string, @Body(new ZodValidationPipe(AddTalentPoolMemberDtoSchema)) dto: dtos.AddTalentPoolMemberDto, @Req() req: Request) {
    const ar = await this.talentPoolRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Talent pool not found');
    return this.commandBus.execute(this.buildCommand('RemoveTalentPoolMember', 'TalentPool', { talentPoolId: new Uuid(id), memberId: dto.memberId }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('talent-pools/:id/commands/close')
  async closeTalentPool(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.talentPoolRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Talent pool not found');
    return this.commandBus.execute(this.buildCommand('CloseTalentPool', 'TalentPool', { talentPoolId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('talent-pools/:id')
  async getTalentPool(@Param('id') id: string) {
    return this.talentPoolRepo.findById(new Uuid(id));
  }

  @Get('talent-pools/tenant/:tenantId')
  async getTalentPoolsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.talentPoolRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  /* Career Paths */
  @Post('career-paths')
  async createCareerPath(@Body(new ZodValidationPipe(CreateCareerPathDtoSchema)) dto: dtos.CreateCareerPathDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateCareerPath', 'CareerPath', dto, req));
  }

  @Post('career-paths/:id/commands/activate')
  async activateCareerPath(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.careerPathRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Career path not found');
    return this.commandBus.execute(this.buildCommand('ActivateCareerPath', 'CareerPath', { careerPathId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('career-paths/:id/commands/achieve-milestone')
  async achieveCareerPathMilestone(@Param('id') id: string, @Body(new ZodValidationPipe(AchieveCareerPathMilestoneDtoSchema)) dto: dtos.AchieveCareerPathMilestoneDto, @Req() req: Request) {
    const ar = await this.careerPathRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Career path not found');
    return this.commandBus.execute(this.buildCommand('AchieveCareerPathMilestone', 'CareerPath', { careerPathId: new Uuid(id), milestoneId: dto.milestoneId }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('career-paths/:id/commands/archive')
  async archiveCareerPath(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.careerPathRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Career path not found');
    return this.commandBus.execute(this.buildCommand('ArchiveCareerPath', 'CareerPath', { careerPathId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('career-paths/:id')
  async getCareerPath(@Param('id') id: string) {
    return this.careerPathRepo.findById(new Uuid(id));
  }

  @Get('career-paths/tenant/:tenantId')
  async getCareerPathsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.careerPathRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  /* Succession Plans */
  @Post('succession-plans')
  async createSuccessionPlan(@Body(new ZodValidationPipe(CreateSuccessionPlanDtoSchema)) dto: dtos.CreateSuccessionPlanDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateSuccessionPlan', 'SuccessionPlan', dto, req));
  }

  @Post('succession-plans/:id/commands/activate')
  async activateSuccessionPlan(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.successionPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Succession plan not found');
    return this.commandBus.execute(this.buildCommand('ActivateSuccessionPlan', 'SuccessionPlan', { successionPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('succession-plans/:id/commands/review')
  async reviewSuccessionPlan(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.successionPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Succession plan not found');
    return this.commandBus.execute(this.buildCommand('ReviewSuccessionPlan', 'SuccessionPlan', { successionPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('succession-plans/:id/commands/execute')
  async executeSuccessionPlan(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.successionPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Succession plan not found');
    return this.commandBus.execute(this.buildCommand('ExecuteSuccessionPlan', 'SuccessionPlan', { successionPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('succession-plans/:id/commands/close')
  async closeSuccessionPlan(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.successionPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Succession plan not found');
    return this.commandBus.execute(this.buildCommand('CloseSuccessionPlan', 'SuccessionPlan', { successionPlanId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('succession-plans/:id/commands/update-readiness')
  async updateSuccessionReadiness(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateSuccessionReadinessDtoSchema)) dto: dtos.UpdateSuccessionReadinessDto, @Req() req: Request) {
    const ar = await this.successionPlanRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Succession plan not found');
    return this.commandBus.execute(this.buildCommand('UpdateSuccessionReadiness', 'SuccessionPlan', { successionPlanId: new Uuid(id), workerId: dto.workerId, readinessLevel: dto.readinessLevel }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('succession-plans/:id')
  async getSuccessionPlan(@Param('id') id: string) {
    return this.successionPlanRepo.findById(new Uuid(id));
  }

  @Get('succession-plans/position/:positionId')
  async getSuccessionPlanByPosition(@Param('positionId') positionId: string) {
    return this.successionPlanRepo.findByPosition(new Uuid(positionId));
  }

  @Get('succession-plans/tenant/:tenantId')
  async getSuccessionPlansByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.successionPlanRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }
}
