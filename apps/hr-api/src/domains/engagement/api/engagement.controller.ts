import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { EngagementSurveyRepository } from '../repositories/engagement-survey.repository.js';
import { SurveyResponseRepository } from '../repositories/survey-response.repository.js';
import { Feedback360CycleRepository } from '../repositories/feedback-360-cycle.repository.js';
import { RecognitionProgramRepository } from '../repositories/recognition-program.repository.js';
import { RecognitionRecordRepository } from '../repositories/recognition-record.repository.js';
import type * as dtos from './dtos.js';
import {
  CreateEngagementSurveyDtoSchema, CreateSurveyResponseDtoSchema,
  CompleteSurveyResponseDtoSchema, CreateFeedback360CycleDtoSchema,
  CreateRecognitionProgramDtoSchema, CreateRecognitionRecordDtoSchema,
  ApproveRecognitionRecordDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

@ApiTags('Engagement')
@Controller('engagement')
export class EngagementController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly surveyRepo: EngagementSurveyRepository,
    private readonly responseRepo: SurveyResponseRepository,
    private readonly feedbackRepo: Feedback360CycleRepository,
    private readonly programRepo: RecognitionProgramRepository,
    private readonly recordRepo: RecognitionRecordRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = requireTenantId(req, 'Engagement');
    const actor = requireActor(req, 'Engagement');
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

  /* Engagement Surveys */
  @Post('surveys')
  async createSurvey(@Body(new ZodValidationPipe(CreateEngagementSurveyDtoSchema)) dto: dtos.CreateEngagementSurveyDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateEngagementSurvey', 'EngagementSurvey', dto, req));
  }

  @Post('surveys/:id/commands/publish')
  async publishSurvey(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.surveyRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Survey not found');
    return this.commandBus.execute(this.buildCommand('PublishEngagementSurvey', 'EngagementSurvey', { engagementSurveyId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('surveys/:id/commands/activate')
  async activateSurvey(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.surveyRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Survey not found');
    return this.commandBus.execute(this.buildCommand('ActivateEngagementSurvey', 'EngagementSurvey', { engagementSurveyId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('surveys/:id/commands/close')
  async closeSurvey(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.surveyRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Survey not found');
    return this.commandBus.execute(this.buildCommand('CloseEngagementSurvey', 'EngagementSurvey', { engagementSurveyId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('surveys/:id/commands/analyze')
  async analyzeSurvey(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.surveyRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Survey not found');
    return this.commandBus.execute(this.buildCommand('AnalyzeEngagementSurvey', 'EngagementSurvey', { engagementSurveyId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('surveys/:id')
  async getSurvey(@Param('id') id: string) {
    return this.surveyRepo.findById(new Uuid(id));
  }

  @Get('surveys/tenant/:tenantId')
  async getSurveysByTenant(@Param('tenantId') tenantId: string) {
    return this.surveyRepo.findByTenant(new Uuid(tenantId));
  }

  /* Survey Responses */
  @Post('survey-responses')
  async createSurveyResponse(@Body(new ZodValidationPipe(CreateSurveyResponseDtoSchema)) dto: dtos.CreateSurveyResponseDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateSurveyResponse', 'SurveyResponse', dto, req));
  }

  @Post('survey-responses/:id/commands/complete')
  async completeSurveyResponse(@Param('id') id: string, @Body(new ZodValidationPipe(CompleteSurveyResponseDtoSchema)) dto: dtos.CompleteSurveyResponseDto, @Req() req: Request) {
    const ar = await this.responseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Survey response not found');
    return this.commandBus.execute(this.buildCommand('CompleteSurveyResponse', 'SurveyResponse', { surveyResponseId: new Uuid(id), responses: dto.responses }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('survey-responses/:id/commands/submit')
  async submitSurveyResponse(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.responseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Survey response not found');
    return this.commandBus.execute(this.buildCommand('SubmitSurveyResponse', 'SurveyResponse', { surveyResponseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('survey-responses/:id')
  async getSurveyResponse(@Param('id') id: string) {
    return this.responseRepo.findById(new Uuid(id));
  }

  @Get('survey-responses/survey/:surveyId')
  async getSurveyResponsesBySurvey(@Param('surveyId') surveyId: string) {
    return this.responseRepo.findBySurvey(new Uuid(surveyId));
  }

  /* Feedback 360 Cycles */
  @Post('feedback-360-cycles')
  async createFeedback360Cycle(@Body(new ZodValidationPipe(CreateFeedback360CycleDtoSchema)) dto: dtos.CreateFeedback360CycleDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateFeedback360Cycle', 'Feedback360Cycle', dto, req));
  }

  @Post('feedback-360-cycles/:id/commands/activate')
  async activateFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.feedbackRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 cycle not found');
    return this.commandBus.execute(this.buildCommand('ActivateFeedback360Cycle', 'Feedback360Cycle', { feedback360CycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('feedback-360-cycles/:id/commands/start')
  async startFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.feedbackRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 cycle not found');
    return this.commandBus.execute(this.buildCommand('StartFeedback360Cycle', 'Feedback360Cycle', { feedback360CycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('feedback-360-cycles/:id/commands/complete')
  async completeFeedback360Cycle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.feedbackRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Feedback 360 cycle not found');
    return this.commandBus.execute(this.buildCommand('CompleteFeedback360Cycle', 'Feedback360Cycle', { feedback360CycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('feedback-360-cycles/:id')
  async getFeedback360Cycle(@Param('id') id: string) {
    return this.feedbackRepo.findById(new Uuid(id));
  }

  @Get('feedback-360-cycles/subject/:workerId')
  async getFeedback360CyclesBySubject(@Param('workerId') workerId: string) {
    return this.feedbackRepo.findBySubjectWorker(new Uuid(workerId));
  }

  /* Recognition Programs */
  @Post('recognition-programs')
  async createRecognitionProgram(@Body(new ZodValidationPipe(CreateRecognitionProgramDtoSchema)) dto: dtos.CreateRecognitionProgramDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateRecognitionProgram', 'RecognitionProgram', dto, req));
  }

  @Post('recognition-programs/:id/commands/activate')
  async activateRecognitionProgram(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.programRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Recognition program not found');
    return this.commandBus.execute(this.buildCommand('ActivateRecognitionProgram', 'RecognitionProgram', { recognitionProgramId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('recognition-programs/:id/commands/suspend')
  async suspendRecognitionProgram(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.programRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Recognition program not found');
    return this.commandBus.execute(this.buildCommand('SuspendRecognitionProgram', 'RecognitionProgram', { recognitionProgramId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('recognition-programs/:id/commands/close')
  async closeRecognitionProgram(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.programRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Recognition program not found');
    return this.commandBus.execute(this.buildCommand('CloseRecognitionProgram', 'RecognitionProgram', { recognitionProgramId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('recognition-programs/:id')
  async getRecognitionProgram(@Param('id') id: string) {
    return this.programRepo.findById(new Uuid(id));
  }

  @Get('recognition-programs/tenant/:tenantId')
  async getRecognitionProgramsByTenant(@Param('tenantId') tenantId: string) {
    return this.programRepo.findByTenant(new Uuid(tenantId));
  }

  /* Recognition Records */
  @Post('recognition-records')
  async createRecognitionRecord(@Body(new ZodValidationPipe(CreateRecognitionRecordDtoSchema)) dto: dtos.CreateRecognitionRecordDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateRecognitionRecord', 'RecognitionRecord', dto, req));
  }

  @Post('recognition-records/:id/commands/approve')
  async approveRecognitionRecord(@Param('id') id: string, @Body(new ZodValidationPipe(ApproveRecognitionRecordDtoSchema)) dto: dtos.ApproveRecognitionRecordDto, @Req() req: Request) {
    const ar = await this.recordRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Recognition record not found');
    return this.commandBus.execute(this.buildCommand('ApproveRecognitionRecord', 'RecognitionRecord', { recognitionRecordId: new Uuid(id), approvedBy: new Uuid(dto.approvedBy) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('recognition-records/:id/commands/award')
  async awardRecognitionRecord(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.recordRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Recognition record not found');
    return this.commandBus.execute(this.buildCommand('AwardRecognitionRecord', 'RecognitionRecord', { recognitionRecordId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('recognition-records/:id/commands/cancel')
  async cancelRecognitionRecord(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.recordRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Recognition record not found');
    return this.commandBus.execute(this.buildCommand('CancelRecognitionRecord', 'RecognitionRecord', { recognitionRecordId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('recognition-records/:id/commands/reject')
  async rejectRecognitionRecord(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.recordRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Recognition record not found');
    return this.commandBus.execute(this.buildCommand('RejectRecognitionRecord', 'RecognitionRecord', { recognitionRecordId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('recognition-records/:id')
  async getRecognitionRecord(@Param('id') id: string) {
    return this.recordRepo.findById(new Uuid(id));
  }

  @Get('recognition-records/worker/:workerId')
  async getRecognitionRecordsByWorker(@Param('workerId') workerId: string) {
    return this.recordRepo.findByWorker(new Uuid(workerId));
  }
}
