import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { EapReferralRepository } from '../repositories/eap-referral.repository.js';
import { WellnessProgramRepository } from '../repositories/wellness-program.repository.js';
import { MentalHealthCaseRepository } from '../repositories/mental-health-case.repository.js';
import type * as dtos from './wellbeing-eap.dto.js';
import {
  CreateEapReferralDto,
  CreateWellnessProgramDto,
  CreateMentalHealthCaseDto,
  ZodValidationPipe,
} from './wellbeing-eap.dto.js';

@ApiTags('Wellbeing EAP')
@Controller('wellbeing-eap')
export class WellbeingEapController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly eapReferralRepo: EapReferralRepository,
    private readonly wellnessProgramRepo: WellnessProgramRepository,
    private readonly mentalHealthCaseRepo: MentalHealthCaseRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = requireTenantId(req, 'Wellbeing EAP');
    const actor = requireActor(req, 'Wellbeing EAP');
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
    const requestTenantId = requireTenantId(req, 'Wellbeing EAP');
    if (requestTenantId.value !== tenantId) {
      throw new BadRequestException('Tenant mismatch');
    }
    return requestTenantId;
  }

  @Post('eap-referrals')
  async createReferral(@Body(new ZodValidationPipe(CreateEapReferralDto)) dto: dtos.CreateEapReferralDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateEapReferral', 'EapReferral', dto, req));
  }

  @Post('eap-referrals/:id/commands/schedule')
  async scheduleReferral(@Param('id') id: string, @Body() body: { scheduledDate: Date }, @Req() req: Request) {
    const ar = await this.eapReferralRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('EAP referral not found');
    return this.commandBus.execute(this.buildCommand('ScheduleEapReferral', 'EapReferral', { eapReferralId: new Uuid(id), ...body }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('eap-referrals/:id/commands/start')
  async startReferral(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.eapReferralRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('EAP referral not found');
    return this.commandBus.execute(this.buildCommand('StartEapReferral', 'EapReferral', { eapReferralId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('eap-referrals/:id/commands/complete')
  async completeReferral(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.eapReferralRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('EAP referral not found');
    return this.commandBus.execute(this.buildCommand('CompleteEapReferral', 'EapReferral', { eapReferralId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('eap-referrals/:id/commands/close')
  async closeReferral(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.eapReferralRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('EAP referral not found');
    return this.commandBus.execute(this.buildCommand('CloseEapReferral', 'EapReferral', { eapReferralId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('eap-referrals/:id/commands/cancel')
  async cancelReferral(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.eapReferralRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('EAP referral not found');
    return this.commandBus.execute(this.buildCommand('CancelEapReferral', 'EapReferral', { eapReferralId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('eap-referrals/:id')
  async getReferral(@Param('id') id: string) {
    return this.eapReferralRepo.findById(new Uuid(id));
  }

  @Get('eap-referrals/tenant/:tenantId')
  async getReferralsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.eapReferralRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Post('wellness-programs')
  async createProgram(@Body(new ZodValidationPipe(CreateWellnessProgramDto)) dto: dtos.CreateWellnessProgramDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateWellnessProgram', 'WellnessProgram', dto, req));
  }

  @Post('wellness-programs/:id/commands/activate')
  async activateProgram(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.wellnessProgramRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Wellness program not found');
    return this.commandBus.execute(this.buildCommand('ActivateWellnessProgram', 'WellnessProgram', { wellnessProgramId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('wellness-programs/:id/commands/enroll')
  async enrollProgram(@Param('id') id: string, @Body() body: { workerId: string }, @Req() req: Request) {
    const ar = await this.wellnessProgramRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Wellness program not found');
    return this.commandBus.execute(this.buildCommand('EnrollWellnessProgram', 'WellnessProgram', { wellnessProgramId: new Uuid(id), workerId: new Uuid(body.workerId) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('wellness-programs/:id/commands/complete')
  async completeProgram(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.wellnessProgramRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Wellness program not found');
    return this.commandBus.execute(this.buildCommand('CompleteWellnessProgram', 'WellnessProgram', { wellnessProgramId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('wellness-programs/:id/commands/cancel')
  async cancelProgram(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.wellnessProgramRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Wellness program not found');
    return this.commandBus.execute(this.buildCommand('CancelWellnessProgram', 'WellnessProgram', { wellnessProgramId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('wellness-programs/:id/commands/archive')
  async archiveProgram(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.wellnessProgramRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Wellness program not found');
    return this.commandBus.execute(this.buildCommand('ArchiveWellnessProgram', 'WellnessProgram', { wellnessProgramId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('wellness-programs/:id')
  async getProgram(@Param('id') id: string) {
    return this.wellnessProgramRepo.findById(new Uuid(id));
  }

  @Get('wellness-programs/tenant/:tenantId')
  async getProgramsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.wellnessProgramRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Post('mental-health-cases')
  async createMhCase(@Body(new ZodValidationPipe(CreateMentalHealthCaseDto)) dto: dtos.CreateMentalHealthCaseDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateMentalHealthCase', 'MentalHealthCase', dto, req));
  }

  @Post('mental-health-cases/:id/commands/assign-to')
  async assignMhCase(@Param('id') id: string, @Body() body: { providerId: string }, @Req() req: Request) {
    const ar = await this.mentalHealthCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Mental health case not found');
    return this.commandBus.execute(this.buildCommand('AssignToMentalHealthCase', 'MentalHealthCase', { mentalHealthCaseId: new Uuid(id), providerId: new Uuid(body.providerId) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('mental-health-cases/:id/commands/start')
  async startMhCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.mentalHealthCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Mental health case not found');
    return this.commandBus.execute(this.buildCommand('StartMentalHealthCase', 'MentalHealthCase', { mentalHealthCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('mental-health-cases/:id/commands/resolve')
  async resolveMhCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.mentalHealthCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Mental health case not found');
    return this.commandBus.execute(this.buildCommand('ResolveMentalHealthCase', 'MentalHealthCase', { mentalHealthCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('mental-health-cases/:id/commands/close')
  async closeMhCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.mentalHealthCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Mental health case not found');
    return this.commandBus.execute(this.buildCommand('CloseMentalHealthCase', 'MentalHealthCase', { mentalHealthCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('mental-health-cases/:id')
  async getMhCase(@Param('id') id: string) {
    return this.mentalHealthCaseRepo.findById(new Uuid(id));
  }

  @Get('mental-health-cases/tenant/:tenantId')
  async getMhCasesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.mentalHealthCaseRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }
}
