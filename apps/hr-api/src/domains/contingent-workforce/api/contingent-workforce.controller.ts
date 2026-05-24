import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { ContingentWorkerAssignmentRepository } from '../repositories/contingent-worker-assignment.repository.js';
import { SowEngagementRepository } from '../repositories/sow-engagement.repository.js';
import { ContractorRateCardRepository } from '../repositories/contractor-rate-card.repository.js';
import { MisclassificationAssessmentRepository } from '../repositories/misclassification-assessment.repository.js';
import type * as dtos from './contingent-workforce.dto.js';
import {
  CreateContingentWorkerAssignmentDto,
  CreateSowEngagementDto,
  CreateContractorRateCardDto,
  CreateMisclassificationAssessmentDto,
  ZodValidationPipe,
} from './contingent-workforce.dto.js';

@ApiTags('Contingent Workforce')
@Controller('contingent-workforce')
export class ContingentWorkforceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly cwaRepo: ContingentWorkerAssignmentRepository,
    private readonly sowRepo: SowEngagementRepository,
    private readonly rateCardRepo: ContractorRateCardRepository,
    private readonly assessmentRepo: MisclassificationAssessmentRepository,
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
      actor: { actorType: 'SYSTEM', actorId: Uuid.generate(), roles: ['HR_ADMIN'], permissions: ['CONTINGENT_WORKFORCE_WRITE'], mfaAuthenticated: true },
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

  @Post('contingent-worker-assignments')
  async createAssignment(@Body(new ZodValidationPipe(CreateContingentWorkerAssignmentDto)) dto: dtos.CreateContingentWorkerAssignmentDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateContingentWorkerAssignment', 'ContingentWorkerAssignment', dto, req));
  }

  @Post('contingent-worker-assignments/:id/commands/activate')
  async activateAssignment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cwaRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contingent worker assignment not found');
    return this.commandBus.execute(this.buildCommand('ActivateContingentWorkerAssignment', 'ContingentWorkerAssignment', { contingentWorkerAssignmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('contingent-worker-assignments/:id/commands/extend')
  async extendAssignment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cwaRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contingent worker assignment not found');
    return this.commandBus.execute(this.buildCommand('ExtendContingentWorkerAssignment', 'ContingentWorkerAssignment', { contingentWorkerAssignmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('contingent-worker-assignments/:id/commands/terminate')
  async terminateAssignment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cwaRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contingent worker assignment not found');
    return this.commandBus.execute(this.buildCommand('TerminateContingentWorkerAssignment', 'ContingentWorkerAssignment', { contingentWorkerAssignmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('contingent-worker-assignments/:id')
  async getAssignment(@Param('id') id: string) {
    return this.cwaRepo.findById(new Uuid(id));
  }

  @Post('sow-engagements')
  async createSow(@Body(new ZodValidationPipe(CreateSowEngagementDto)) dto: dtos.CreateSowEngagementDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateSowEngagement', 'SowEngagement', dto, req));
  }

  @Post('sow-engagements/:id/commands/activate')
  async activateSow(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.sowRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('SOW engagement not found');
    return this.commandBus.execute(this.buildCommand('ActivateSowEngagement', 'SowEngagement', { sowEngagementId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('sow-engagements/:id/commands/start')
  async startSow(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.sowRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('SOW engagement not found');
    return this.commandBus.execute(this.buildCommand('StartSowEngagement', 'SowEngagement', { sowEngagementId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('sow-engagements/:id/commands/complete')
  async completeSow(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.sowRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('SOW engagement not found');
    return this.commandBus.execute(this.buildCommand('CompleteSowEngagement', 'SowEngagement', { sowEngagementId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('sow-engagements/:id/commands/close')
  async closeSow(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.sowRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('SOW engagement not found');
    return this.commandBus.execute(this.buildCommand('CloseSowEngagement', 'SowEngagement', { sowEngagementId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('sow-engagements/:id')
  async getSow(@Param('id') id: string) {
    return this.sowRepo.findById(new Uuid(id));
  }

  @Post('contractor-rate-cards')
  async createRateCard(@Body(new ZodValidationPipe(CreateContractorRateCardDto)) dto: dtos.CreateContractorRateCardDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateContractorRateCard', 'ContractorRateCard', dto, req));
  }

  @Post('contractor-rate-cards/:id/commands/activate')
  async activateRateCard(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.rateCardRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contractor rate card not found');
    return this.commandBus.execute(this.buildCommand('ActivateContractorRateCard', 'ContractorRateCard', { contractorRateCardId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('contractor-rate-cards/:id/commands/revise')
  async reviseRateCard(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.rateCardRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contractor rate card not found');
    return this.commandBus.execute(this.buildCommand('ReviseContractorRateCard', 'ContractorRateCard', { contractorRateCardId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('contractor-rate-cards/:id/commands/expire')
  async expireRateCard(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.rateCardRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contractor rate card not found');
    return this.commandBus.execute(this.buildCommand('ExpireContractorRateCard', 'ContractorRateCard', { contractorRateCardId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('contractor-rate-cards/:id')
  async getRateCard(@Param('id') id: string) {
    return this.rateCardRepo.findById(new Uuid(id));
  }

  @Post('misclassification-assessments')
  async createAssessment(@Body(new ZodValidationPipe(CreateMisclassificationAssessmentDto)) dto: dtos.CreateMisclassificationAssessmentDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateMisclassificationAssessment', 'MisclassificationAssessment', dto, req));
  }

  @Post('misclassification-assessments/:id/commands/start')
  async startAssessment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.assessmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Misclassification assessment not found');
    return this.commandBus.execute(this.buildCommand('StartMisclassificationAssessment', 'MisclassificationAssessment', { misclassificationAssessmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('misclassification-assessments/:id/commands/mark-review-required')
  async markReviewRequiredAssessment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.assessmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Misclassification assessment not found');
    return this.commandBus.execute(this.buildCommand('MarkReviewRequiredMisclassificationAssessment', 'MisclassificationAssessment', { misclassificationAssessmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('misclassification-assessments/:id/commands/clear')
  async clearAssessment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.assessmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Misclassification assessment not found');
    return this.commandBus.execute(this.buildCommand('ClearMisclassificationAssessment', 'MisclassificationAssessment', { misclassificationAssessmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('misclassification-assessments/:id/commands/flag')
  async flagAssessment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.assessmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Misclassification assessment not found');
    return this.commandBus.execute(this.buildCommand('FlagMisclassificationAssessment', 'MisclassificationAssessment', { misclassificationAssessmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('misclassification-assessments/:id')
  async getAssessment(@Param('id') id: string) {
    return this.assessmentRepo.findById(new Uuid(id));
  }
}
