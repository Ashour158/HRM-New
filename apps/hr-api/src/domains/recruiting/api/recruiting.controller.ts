import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Req,
  UsePipes,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Uuid } from '@hcm/shared-kernel';
import { createCommand } from '@hcm/command-contracts';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { Request } from 'express';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';

import { ZodValidationPipe } from '../../../pipes/zod-validation.pipe.js';
import { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { InterviewPlanRepository } from '../repositories/interview-plan.repository.js';
import { OfferRepository } from '../repositories/offer.repository.js';
import { RequisitionAdverseImpactAnalysisRepository } from '../repositories/requisition-adverse-impact-analysis.repository.js';

import {
  CreateJobRequisitionDto,
  CloseJobRequisitionDto,
  SubmitCandidateDto,
  ScreenCandidateDto,
  ScheduleInterviewDto,
  CreateOfferDto,
  SendOfferDto,
  AcceptOfferDto,
  RecordCandidateEeoSelfIdentificationDto,
  AnalyzeRequisitionAdverseImpactDto,
  ReviewRequisitionAdverseImpactAnalysisDto,
} from './dtos.js';

// Adverse-impact analysis results are group-level and k-anonymity-suppressed,
// but still surface protected-class outcome data — restrict reads to the
// same admin classes as the dei-analytics domain's equivalent reports.
const ADVERSE_IMPACT_ANALYTICS_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'DEI_ANALYTICS_ADMIN',
  'PEOPLE_ANALYTICS_ADMIN',
  'COMPLIANCE_OFFICER',
]);

@ApiTags('Recruiting')
@Controller('hr/recruiting')
@UsePipes(ZodValidationPipe)
export class RecruitingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly requisitionRepo: JobRequisitionRepository,
    private readonly candidateRepo: CandidateRepository,
    private readonly interviewPlanRepo: InterviewPlanRepository,
    private readonly offerRepo: OfferRepository,
    private readonly adverseImpactAnalysisRepo: RequisitionAdverseImpactAnalysisRepository,
  ) {}

  /* ── Job Requisitions ────────────────────────────────────────── */

  @Post('requisitions')
  @ApiOperation({ summary: 'Create a new job requisition' })
  async createRequisition(
    @Body() dto: CreateJobRequisitionDto,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('CreateJobRequisition', req, dto, {
      aggregateType: 'JobRequisition',
      reason: 'Create job requisition via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('requisitions/:id/commands/approve')
  @ApiOperation({ summary: 'Approve a job requisition' })
  @ApiParam({ name: 'id', description: 'Requisition UUID' })
  async approveRequisition(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('ApproveJobRequisition', req, { requisitionId: id }, {
      aggregateType: 'JobRequisition',
      aggregateId: id,
      expectedState: 'PENDING_APPROVAL',
      reason: 'Approve job requisition via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('requisitions/:id/commands/publish')
  @ApiOperation({ summary: 'Publish a job requisition' })
  @ApiParam({ name: 'id', description: 'Requisition UUID' })
  async publishRequisition(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('PublishJobRequisition', req, { requisitionId: id }, {
      aggregateType: 'JobRequisition',
      aggregateId: id,
      expectedState: 'APPROVED',
      reason: 'Publish job requisition via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('requisitions/:id/commands/close')
  @ApiOperation({ summary: 'Close a job requisition' })
  @ApiParam({ name: 'id', description: 'Requisition UUID' })
  async closeRequisition(
    @Param('id') id: string,
    @Body() dto: CloseJobRequisitionDto,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('CloseJobRequisition', req, { requisitionId: id, reason: dto.reason }, {
      aggregateType: 'JobRequisition',
      aggregateId: id,
      reason: 'Close job requisition via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Get('requisitions')
  @ApiOperation({ summary: 'List job requisitions with optional filters' })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'position', required: false })
  async listRequisitions(
    @Req() req: Request,
    @Query('department') departmentId?: string,
    @Query('position') positionId?: string,
  ) {
    if (departmentId) {
      return this.requisitionRepo.findByDepartment(new Uuid(departmentId));
    }
    if (positionId) {
      return this.requisitionRepo.findByPosition(new Uuid(positionId));
    }
    // No generic findAll on repository; return open requisitions as default
    return this.requisitionRepo.findOpen(this.tenantId(req));
  }

  @Get('requisitions/open')
  @ApiOperation({ summary: 'List open job requisitions' })
  async listOpenRequisitions(@Req() req: Request) {
    return this.requisitionRepo.findOpen(this.tenantId(req));
  }

  @Get('requisitions/:id')
  @ApiOperation({ summary: 'Get a job requisition by ID' })
  @ApiParam({ name: 'id', description: 'Requisition UUID' })
  async getRequisition(@Param('id') id: string) {
    const requisition = await this.requisitionRepo.findById(new Uuid(id));
    if (!requisition) {
      throw new BadRequestException('Requisition not found');
    }
    return {
      id: requisition.id.value,
      requisitionNumber: requisition.requisitionNumber,
      title: requisition.title,
      status: requisition.status,
      positionId: requisition.positionId.value,
      departmentId: requisition.departmentId?.value,
      version: requisition.aggregateVersion,
    };
  }

  /* ── Candidates ──────────────────────────────────────────────── */

  @Post('candidates')
  @ApiOperation({ summary: 'Submit a candidate application' })
  async submitCandidate(
    @Body() dto: SubmitCandidateDto,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('SubmitCandidateApplication', req, dto, {
      aggregateType: 'Candidate',
      reason: 'Submit candidate application via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('candidates/:id/commands/screen')
  @ApiOperation({ summary: 'Screen a candidate' })
  @ApiParam({ name: 'id', description: 'Candidate UUID' })
  async screenCandidate(
    @Param('id') id: string,
    @Body() dto: ScreenCandidateDto,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('ScreenCandidate', req, { applicationId: id, ...dto }, {
      aggregateType: 'Candidate',
      aggregateId: id,
      expectedState: 'NEW',
      reason: 'Screen candidate via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('candidates/:id/commands/schedule-interview')
  @ApiOperation({ summary: 'Schedule an interview for a candidate' })
  @ApiParam({ name: 'id', description: 'Candidate UUID' })
  async scheduleInterviewForCandidate(
    @Param('id') id: string,
    @Body() dto: ScheduleInterviewDto,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('ScheduleInterview', req, { applicationId: id, ...dto }, {
      aggregateType: 'InterviewPlan',
      reason: 'Schedule interview via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Get('candidates')
  @ApiOperation({ summary: 'List candidates with optional filters' })
  @ApiQuery({ name: 'requisition', required: false })
  @ApiQuery({ name: 'status', required: false })
  async listCandidates(
    @Query('requisition') requisitionId?: string,
    @Query('status') status?: string,
  ) {
    if (requisitionId) {
      return this.candidateRepo.findByRequisition(new Uuid(requisitionId));
    }
    if (status) {
      return this.candidateRepo.findByStatus(status as import('../aggregates/candidate.aggregate.js').CandidateStatus);
    }
    return [];
  }

  @Get('candidates/:id')
  @ApiOperation({ summary: 'Get a candidate by ID' })
  @ApiParam({ name: 'id', description: 'Candidate UUID' })
  async getCandidate(@Param('id') id: string) {
    const candidate = await this.candidateRepo.findById(new Uuid(id));
    if (!candidate) {
      throw new BadRequestException('Candidate not found');
    }
    return {
      id: candidate.id.value,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      status: candidate.status,
      requisitionId: candidate.requisitionId.value,
      version: candidate.aggregateVersion,
    };
  }

  @Post('candidates/:id/eeo-self-identification')
  @ApiOperation({
    summary: 'Record a candidate\'s voluntary EEO self-identification (race/ethnicity, gender identity, veteran status, disability status)',
  })
  @ApiParam({ name: 'id', description: 'Candidate UUID' })
  async recordCandidateEeoSelfIdentification(
    @Param('id') id: string,
    @Body() dto: RecordCandidateEeoSelfIdentificationDto,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('RecordCandidateEeoSelfIdentification', req, { candidateId: id, ...dto }, {
      aggregateType: 'Candidate',
      aggregateId: id,
      reason: 'Record voluntary EEO self-identification via API',
    });
    return this.commandBus.execute(envelope);
  }

  /* ── Interviews ──────────────────────────────────────────────── */

  @Post('interviews')
  @ApiOperation({ summary: 'Schedule an interview' })
  async createInterview(
    @Body() dto: ScheduleInterviewDto,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('ScheduleInterview', req, dto, {
      aggregateType: 'InterviewPlan',
      reason: 'Schedule interview via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('interviews/:id/commands/complete')
  @ApiOperation({ summary: 'Complete an interview' })
  @ApiParam({ name: 'id', description: 'Interview UUID' })
  async completeInterview(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const plan = await this.interviewPlanRepo.findById(new Uuid(id));
    if (!plan) throw new BadRequestException('Interview plan not found');
    const envelope = this.buildCommand('CompleteInterview', req, { interviewId: id }, {
      aggregateType: 'InterviewPlan',
      aggregateId: id,
      expectedState: plan.status,
      reason: 'Complete interview via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('interviews/:id/commands/cancel')
  @ApiOperation({ summary: 'Cancel an interview' })
  @ApiParam({ name: 'id', description: 'Interview UUID' })
  async cancelInterview(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const plan = await this.interviewPlanRepo.findById(new Uuid(id));
    if (!plan) throw new BadRequestException('Interview plan not found');
    const envelope = this.buildCommand('CancelInterview', req, { interviewId: id }, {
      aggregateType: 'InterviewPlan',
      aggregateId: id,
      expectedState: plan.status,
      reason: 'Cancel interview via API',
    });
    return this.commandBus.execute(envelope);
  }

  /* ── Offers ──────────────────────────────────────────────────── */

  @Post('offers')
  @ApiOperation({ summary: 'Create a new offer' })
  async createOffer(
    @Body() dto: CreateOfferDto,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('CreateOffer', req, dto, {
      aggregateType: 'Offer',
      reason: 'Create offer via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('offers/:id/commands/approve')
  @ApiOperation({ summary: 'Approve an offer' })
  @ApiParam({ name: 'id', description: 'Offer UUID' })
  async approveOffer(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('ApproveOffer', req, { offerId: id }, {
      aggregateType: 'Offer',
      aggregateId: id,
      expectedState: 'PENDING_APPROVAL',
      reason: 'Approve offer via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('offers/:id/commands/send')
  @ApiOperation({ summary: 'Send an offer' })
  @ApiParam({ name: 'id', description: 'Offer UUID' })
  async sendOffer(
    @Param('id') id: string,
    @Body() _dto: SendOfferDto,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('SendOffer', req, { offerId: id }, {
      aggregateType: 'Offer',
      aggregateId: id,
      expectedState: 'APPROVED',
      reason: 'Send offer via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('offers/:id/commands/accept')
  @ApiOperation({ summary: 'Accept an offer' })
  @ApiParam({ name: 'id', description: 'Offer UUID' })
  async acceptOffer(
    @Param('id') id: string,
    @Body() dto: AcceptOfferDto,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('AcceptOffer', req, { offerId: id, acceptedAt: dto.acceptedAt ?? new Date() }, {
      aggregateType: 'Offer',
      aggregateId: id,
      expectedState: 'SENT',
      reason: 'Accept offer via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Get('offers')
  @ApiOperation({ summary: 'List offers with optional filters' })
  @ApiQuery({ name: 'candidate', required: false })
  @ApiQuery({ name: 'requisition', required: false })
  async listOffers(
    @Query('candidate') candidateId?: string,
    @Query('requisition') requisitionId?: string,
  ) {
    if (candidateId) {
      return this.offerRepo.findByCandidate(new Uuid(candidateId));
    }
    if (requisitionId) {
      return this.offerRepo.findByRequisition(new Uuid(requisitionId));
    }
    return this.offerRepo.findPending();
  }

  @Get('offers/:id')
  @ApiOperation({ summary: 'Get an offer by ID' })
  @ApiParam({ name: 'id', description: 'Offer UUID' })
  async getOffer(@Param('id') id: string) {
    const offer = await this.offerRepo.findById(new Uuid(id));
    if (!offer) {
      throw new BadRequestException('Offer not found');
    }
    return {
      id: offer.id.value,
      candidateId: offer.candidateId.value,
      requisitionId: offer.requisitionId.value,
      proposedSalary: offer.proposedSalary,
      currency: offer.currency,
      status: offer.status,
      version: offer.aggregateVersion,
    };
  }

  /* ── Recruiting Fairness: Adverse Impact Analysis ──────────────── */

  @Post('requisitions/:id/commands/analyze-adverse-impact')
  @ApiOperation({
    summary: 'Run an EEOC 4/5ths-rule adverse-impact analysis on a requisition\'s candidate funnel',
  })
  @ApiParam({ name: 'id', description: 'Requisition UUID' })
  async analyzeRequisitionAdverseImpact(
    @Param('id') id: string,
    @Body() dto: AnalyzeRequisitionAdverseImpactDto,
    @Req() req: Request,
  ) {
    const envelope = this.buildCommand('AnalyzeRequisitionAdverseImpact', req, { requisitionId: id, ...dto }, {
      aggregateType: 'RequisitionAdverseImpactAnalysis',
      reason: 'Run adverse-impact analysis via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('adverse-impact-analyses/:id/commands/review')
  @ApiOperation({ summary: 'Mark an adverse-impact analysis as reviewed' })
  @ApiParam({ name: 'id', description: 'Adverse impact analysis UUID' })
  async reviewRequisitionAdverseImpactAnalysis(
    @Param('id') id: string,
    @Body() dto: ReviewRequisitionAdverseImpactAnalysisDto,
    @Req() req: Request,
  ) {
    const actor = this.actor(req);
    const envelope = this.buildCommand(
      'ReviewRequisitionAdverseImpactAnalysis',
      req,
      { analysisId: id, reviewedBy: actor.actorId.value, ...dto },
      {
        aggregateType: 'RequisitionAdverseImpactAnalysis',
        aggregateId: id,
        expectedState: 'ANALYZED',
        reason: 'Review adverse-impact analysis via API',
      },
    );
    return this.commandBus.execute(envelope);
  }

  @Get('requisitions/:id/adverse-impact-analyses')
  @ApiOperation({ summary: 'List adverse-impact analyses for a requisition (group-level, suppressed results only)' })
  @ApiParam({ name: 'id', description: 'Requisition UUID' })
  async listRequisitionAdverseImpactAnalyses(@Param('id') id: string, @Req() req: Request) {
    this.assertAdverseImpactAnalyticsScope(req);
    return this.adverseImpactAnalysisRepo.findByRequisition(new Uuid(id));
  }

  @Get('adverse-impact-analyses/:id')
  @ApiOperation({ summary: 'Get an adverse-impact analysis by ID (group-level, suppressed results only)' })
  @ApiParam({ name: 'id', description: 'Adverse impact analysis UUID' })
  async getRequisitionAdverseImpactAnalysis(@Param('id') id: string, @Req() req: Request) {
    this.assertAdverseImpactAnalyticsScope(req);
    const analysis = await this.adverseImpactAnalysisRepo.findById(new Uuid(id));
    if (!analysis) {
      throw new BadRequestException('Adverse impact analysis not found');
    }
    return {
      id: analysis.id.value,
      requisitionId: analysis.requisitionId.value,
      dimension: analysis.dimension,
      decisionCode: analysis.decisionCode,
      flaggedStageCount: analysis.flaggedStageCount,
      smallCellThreshold: analysis.smallCellThreshold,
      stageResults: analysis.stageResults,
      status: analysis.status,
      version: analysis.aggregateVersion,
    };
  }

  /* ── Helpers ─────────────────────────────────────────────────── */

  private buildCommand<TPayload>(
    commandName: string,
    req: Request,
    payload: TPayload,
    options: {
      aggregateType: string;
      aggregateId?: string;
      expectedState?: string;
      reason?: string;
    },
  ): HrCommandEnvelope<TPayload> {
    const actor = this.actor(req);
    return createCommand(
      commandName,
      this.tenantId(req),
      {
        actorType: actor.actorType,
        actorId: actor.actorId,
        roles: actor.roles,
        permissions: actor.permissions,
        mfaAuthenticated: actor.mfaAuthenticated,
        sessionId: actor.sessionId,
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

  private assertAdverseImpactAnalyticsScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => ADVERSE_IMPACT_ANALYTICS_ROLES.has(role))) return;
    throw new ForbiddenException(
      'Only DEI/people-analytics, compliance, or HR administrators can access adverse-impact analyses',
    );
  }

  private tenantId(req: Request): Uuid {
    if (typeof req.tenantId === 'string' && Uuid.isValid(req.tenantId)) {
      return new Uuid(req.tenantId);
    }
    throw new ForbiddenException('Recruiting requires a validated tenant context.');
  }

  private actor(req: Request) {
    const actor = req.actor;
    if (!actor?.actorId) {
      throw new ForbiddenException('Recruiting commands require an authenticated actor.');
    }
    return actor;
  }
}
