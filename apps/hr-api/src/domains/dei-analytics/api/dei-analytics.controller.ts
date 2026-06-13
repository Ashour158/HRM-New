import { Controller, Get, Post, Body, Param, Query, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { DeiReportRepository } from '../repositories/dei-report.repository.js';
import { PayGapReportRepository } from '../repositories/pay-gap-report.repository.js';
import { PayEquityReviewRepository } from '../repositories/pay-equity-review.repository.js';
import { AttritionSegmentReportRepository } from '../repositories/attrition-segment-report.repository.js';
import type * as dtos from './dtos.js';
import {
  CreateDeiReportDtoSchema, GenerateDeiReportDtoSchema,
  CreatePayGapReportDtoSchema, CalculatePayGapReportDtoSchema,
  CreatePayEquityReviewDtoSchema, RecordPayEquityFindingsDtoSchema, StartPayEquityRemediationDtoSchema, ClosePayEquityReviewDtoSchema,
  CreateAttritionSegmentReportDtoSchema, GenerateAttritionSegmentReportDtoSchema, ZodValidationPipe,
} from './dtos.js';

@ApiTags('DEI & People Analytics')
@Controller('dei-analytics')
export class DeiAnalyticsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly deiReportRepo: DeiReportRepository,
    private readonly payGapReportRepo: PayGapReportRepository,
    private readonly payEquityReviewRepo: PayEquityReviewRepository,
    private readonly attritionSegmentReportRepo: AttritionSegmentReportRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string, aggregateType: string, payload: TPayload, req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = requireTenantId(req, 'DEI Analytics');
    const actor = requireActor(req, 'DEI Analytics');
    return {
      commandId: Uuid.generate(), commandName, commandSchemaVersion: 1, tenantId,
      actor,
      aggregateType, aggregateId: options?.aggregateId, expectedState: options?.expectedState, expectedVersion: options?.expectedVersion,
      idempotencyKey: randomUUID(), correlationId: Uuid.generate(), reason: 'API request', payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: actorClientType(actor) },
    };
  }

  @Post('dei-reports')
  async createDeiReport(@Body(new ZodValidationPipe(CreateDeiReportDtoSchema)) dto: dtos.CreateDeiReportDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateDeiReport', 'DeiReport', dto, req));
  }
  @Post('dei-reports/:id/commands/generate')
  async generateDeiReport(@Body(new ZodValidationPipe(GenerateDeiReportDtoSchema)) dto: dtos.GenerateDeiReportDto, @Req() req: Request) {
    const r = await this.deiReportRepo.findById(new Uuid(dto.deiReportId));
    if (!r) throw new BadRequestException('DEI report not found');
    return this.commandBus.execute(this.buildCommand('GenerateDeiReport', 'DeiReport', dto, req, { aggregateId: new Uuid(dto.deiReportId), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Post('dei-reports/:id/commands/review')
  async reviewDeiReport(@Param('id') id: string, @Req() req: Request) {
    const r = await this.deiReportRepo.findById(new Uuid(id));
    if (!r) throw new BadRequestException('DEI report not found');
    return this.commandBus.execute(this.buildCommand('ReviewDeiReport', 'DeiReport', { deiReportId: id }, req, { aggregateId: new Uuid(id), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Post('dei-reports/:id/commands/publish')
  async publishDeiReport(@Param('id') id: string, @Req() req: Request) {
    const r = await this.deiReportRepo.findById(new Uuid(id));
    if (!r) throw new BadRequestException('DEI report not found');
    return this.commandBus.execute(this.buildCommand('PublishDeiReport', 'DeiReport', { deiReportId: id }, req, { aggregateId: new Uuid(id), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Get('dei-reports')
  async listDeiReports(@Query('status') status?: string) { return this.deiReportRepo.findByStatus(status ?? 'DRAFT'); }
  @Get('dei-reports/:id')
  async getDeiReport(@Param('id') id: string) { return this.deiReportRepo.findById(new Uuid(id)); }

  @Post('pay-gap-reports')
  async createPayGapReport(@Body(new ZodValidationPipe(CreatePayGapReportDtoSchema)) dto: dtos.CreatePayGapReportDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreatePayGapReport', 'PayGapReport', dto, req));
  }
  @Post('pay-gap-reports/:id/commands/calculate')
  async calculatePayGapReport(@Body(new ZodValidationPipe(CalculatePayGapReportDtoSchema)) dto: dtos.CalculatePayGapReportDto, @Req() req: Request) {
    const r = await this.payGapReportRepo.findById(new Uuid(dto.payGapReportId));
    if (!r) throw new BadRequestException('Pay gap report not found');
    return this.commandBus.execute(this.buildCommand('CalculatePayGapReport', 'PayGapReport', dto, req, { aggregateId: new Uuid(dto.payGapReportId), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Post('pay-gap-reports/:id/commands/review')
  async reviewPayGapReport(@Param('id') id: string, @Req() req: Request) {
    const r = await this.payGapReportRepo.findById(new Uuid(id));
    if (!r) throw new BadRequestException('Pay gap report not found');
    return this.commandBus.execute(this.buildCommand('ReviewPayGapReport', 'PayGapReport', { payGapReportId: id }, req, { aggregateId: new Uuid(id), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Post('pay-gap-reports/:id/commands/publish')
  async publishPayGapReport(@Param('id') id: string, @Req() req: Request) {
    const r = await this.payGapReportRepo.findById(new Uuid(id));
    if (!r) throw new BadRequestException('Pay gap report not found');
    return this.commandBus.execute(this.buildCommand('PublishPayGapReport', 'PayGapReport', { payGapReportId: id }, req, { aggregateId: new Uuid(id), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Get('pay-gap-reports')
  async listPayGapReports(@Query('status') status?: string) { return this.payGapReportRepo.findByStatus(status ?? 'DRAFT'); }
  @Get('pay-gap-reports/:id')
  async getPayGapReport(@Param('id') id: string) { return this.payGapReportRepo.findById(new Uuid(id)); }

  @Post('pay-equity-reviews')
  async createPayEquityReview(@Body(new ZodValidationPipe(CreatePayEquityReviewDtoSchema)) dto: dtos.CreatePayEquityReviewDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreatePayEquityReview', 'PayEquityReview', dto, req));
  }
  @Post('pay-equity-reviews/:id/commands/start')
  async startPayEquityReview(@Param('id') id: string, @Req() req: Request) {
    const r = await this.payEquityReviewRepo.findById(new Uuid(id));
    if (!r) throw new BadRequestException('Pay equity review not found');
    return this.commandBus.execute(this.buildCommand('StartPayEquityReview', 'PayEquityReview', { payEquityReviewId: id }, req, { aggregateId: new Uuid(id), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Post('pay-equity-reviews/:id/commands/findings')
  async recordPayEquityFindings(@Body(new ZodValidationPipe(RecordPayEquityFindingsDtoSchema)) dto: dtos.RecordPayEquityFindingsDto, @Req() req: Request) {
    const r = await this.payEquityReviewRepo.findById(new Uuid(dto.payEquityReviewId));
    if (!r) throw new BadRequestException('Pay equity review not found');
    return this.commandBus.execute(this.buildCommand('RecordPayEquityFindings', 'PayEquityReview', dto, req, { aggregateId: new Uuid(dto.payEquityReviewId), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Post('pay-equity-reviews/:id/commands/remediation')
  async startPayEquityRemediation(@Body(new ZodValidationPipe(StartPayEquityRemediationDtoSchema)) dto: dtos.StartPayEquityRemediationDto, @Req() req: Request) {
    const r = await this.payEquityReviewRepo.findById(new Uuid(dto.payEquityReviewId));
    if (!r) throw new BadRequestException('Pay equity review not found');
    return this.commandBus.execute(this.buildCommand('StartPayEquityRemediation', 'PayEquityReview', dto, req, { aggregateId: new Uuid(dto.payEquityReviewId), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Post('pay-equity-reviews/:id/commands/close')
  async closePayEquityReview(@Body(new ZodValidationPipe(ClosePayEquityReviewDtoSchema)) dto: dtos.ClosePayEquityReviewDto, @Req() req: Request) {
    const r = await this.payEquityReviewRepo.findById(new Uuid(dto.payEquityReviewId));
    if (!r) throw new BadRequestException('Pay equity review not found');
    return this.commandBus.execute(this.buildCommand('ClosePayEquityReview', 'PayEquityReview', dto, req, { aggregateId: new Uuid(dto.payEquityReviewId), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Get('pay-equity-reviews')
  async listPayEquityReviews(@Query('status') status?: string) { return this.payEquityReviewRepo.findByStatus(status ?? 'PLANNED'); }
  @Get('pay-equity-reviews/:id')
  async getPayEquityReview(@Param('id') id: string) { return this.payEquityReviewRepo.findById(new Uuid(id)); }

  @Post('attrition-segment-reports')
  async createAttritionSegmentReport(@Body(new ZodValidationPipe(CreateAttritionSegmentReportDtoSchema)) dto: dtos.CreateAttritionSegmentReportDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateAttritionSegmentReport', 'AttritionSegmentReport', dto, req));
  }
  @Post('attrition-segment-reports/:id/commands/generate')
  async generateAttritionSegmentReport(@Body(new ZodValidationPipe(GenerateAttritionSegmentReportDtoSchema)) dto: dtos.GenerateAttritionSegmentReportDto, @Req() req: Request) {
    const r = await this.attritionSegmentReportRepo.findById(new Uuid(dto.attritionSegmentReportId));
    if (!r) throw new BadRequestException('Attrition segment report not found');
    return this.commandBus.execute(this.buildCommand('GenerateAttritionSegmentReport', 'AttritionSegmentReport', dto, req, { aggregateId: new Uuid(dto.attritionSegmentReportId), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Post('attrition-segment-reports/:id/commands/publish')
  async publishAttritionSegmentReport(@Param('id') id: string, @Req() req: Request) {
    const r = await this.attritionSegmentReportRepo.findById(new Uuid(id));
    if (!r) throw new BadRequestException('Attrition segment report not found');
    return this.commandBus.execute(this.buildCommand('PublishAttritionSegmentReport', 'AttritionSegmentReport', { attritionSegmentReportId: id }, req, { aggregateId: new Uuid(id), expectedState: r.status, expectedVersion: r.aggregateVersion }));
  }
  @Get('attrition-segment-reports')
  async listAttritionSegmentReports(@Query('status') status?: string) { return this.attritionSegmentReportRepo.findByStatus(status ?? 'DRAFT'); }
  @Get('attrition-segment-reports/:id')
  async getAttritionSegmentReport(@Param('id') id: string) { return this.attritionSegmentReportRepo.findById(new Uuid(id)); }
}
