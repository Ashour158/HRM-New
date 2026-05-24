import { Controller, Get, Post, Body, Param, Query, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { ReportDefinitionRepository } from '../repositories/report-definition.repository.js';
import { ReportExecutionRepository } from '../repositories/report-execution.repository.js';
import { ReportScheduleRepository } from '../repositories/report-schedule.repository.js';
import { CalculatedFieldRepository } from '../repositories/calculated-field.repository.js';
import type * as dtos from './dtos.js';
import {
  CreateReportDefinitionDtoSchema, CreateReportExecutionDtoSchema, CompleteReportExecutionDtoSchema,
  FailReportExecutionDtoSchema, CreateReportScheduleDtoSchema, CreateCalculatedFieldDtoSchema, ZodValidationPipe,
} from './dtos.js';

@ApiTags('Reporting')
@Controller('reporting')
export class ReportingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly reportDefinitionRepo: ReportDefinitionRepository,
    private readonly reportExecutionRepo: ReportExecutionRepository,
    private readonly reportScheduleRepo: ReportScheduleRepository,
    private readonly calculatedFieldRepo: CalculatedFieldRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string, aggregateType: string, payload: TPayload, req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    return {
      commandId: Uuid.generate(), commandName, commandSchemaVersion: 1, tenantId,
      actor: { actorType: 'SYSTEM', actorId: Uuid.generate(), roles: ['HR_ADMIN', 'REPORTING_ADMIN'], permissions: ['REPORTING_CREATE', 'REPORTING_UPDATE', 'REPORTING_READ'], mfaAuthenticated: true },
      aggregateType, aggregateId: options?.aggregateId, expectedState: options?.expectedState, expectedVersion: options?.expectedVersion,
      idempotencyKey: randomUUID(), correlationId: Uuid.generate(), reason: 'API request', payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: 'HR_ADMIN' },
    };
  }

  @Post('report-definitions')
  async createReportDefinition(@Body(new ZodValidationPipe(CreateReportDefinitionDtoSchema)) dto: dtos.CreateReportDefinitionDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateReportDefinition', 'ReportDefinition', dto, req));
  }
  @Post('report-definitions/:id/commands/publish')
  async publishReportDefinition(@Param('id') id: string, @Req() req: Request) {
    const doc = await this.reportDefinitionRepo.findById(new Uuid(id));
    if (!doc) throw new BadRequestException('Report definition not found');
    return this.commandBus.execute(this.buildCommand('PublishReportDefinition', 'ReportDefinition', { reportDefinitionId: id }, req, { aggregateId: new Uuid(id), expectedState: doc.status, expectedVersion: doc.aggregateVersion }));
  }
  @Post('report-definitions/:id/commands/archive')
  async archiveReportDefinition(@Param('id') id: string, @Req() req: Request) {
    const doc = await this.reportDefinitionRepo.findById(new Uuid(id));
    if (!doc) throw new BadRequestException('Report definition not found');
    return this.commandBus.execute(this.buildCommand('ArchiveReportDefinition', 'ReportDefinition', { reportDefinitionId: id }, req, { aggregateId: new Uuid(id), expectedState: doc.status, expectedVersion: doc.aggregateVersion }));
  }
  @Get('report-definitions')
  async listReportDefinitions(@Query('status') status?: string) {
    return this.reportDefinitionRepo.findByStatus(status ?? 'DRAFT');
  }
  @Get('report-definitions/:id')
  async getReportDefinition(@Param('id') id: string) {
    return this.reportDefinitionRepo.findById(new Uuid(id));
  }

  @Post('report-executions')
  async createReportExecution(@Body(new ZodValidationPipe(CreateReportExecutionDtoSchema)) dto: dtos.CreateReportExecutionDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateReportExecution', 'ReportExecution', dto, req));
  }
  @Post('report-executions/:id/commands/queue')
  async queueReportExecution(@Param('id') id: string, @Req() req: Request) {
    const exec = await this.reportExecutionRepo.findById(new Uuid(id));
    if (!exec) throw new BadRequestException('Report execution not found');
    return this.commandBus.execute(this.buildCommand('QueueReportExecution', 'ReportExecution', { reportExecutionId: id }, req, { aggregateId: new Uuid(id), expectedState: exec.status, expectedVersion: exec.aggregateVersion }));
  }
  @Post('report-executions/:id/commands/start')
  async startReportExecution(@Param('id') id: string, @Req() req: Request) {
    const exec = await this.reportExecutionRepo.findById(new Uuid(id));
    if (!exec) throw new BadRequestException('Report execution not found');
    return this.commandBus.execute(this.buildCommand('StartReportExecution', 'ReportExecution', { reportExecutionId: id }, req, { aggregateId: new Uuid(id), expectedState: exec.status, expectedVersion: exec.aggregateVersion }));
  }
  @Post('report-executions/:id/commands/complete')
  async completeReportExecution(@Body(new ZodValidationPipe(CompleteReportExecutionDtoSchema)) dto: dtos.CompleteReportExecutionDto, @Req() req: Request) {
    const exec = await this.reportExecutionRepo.findById(new Uuid(dto.reportExecutionId));
    if (!exec) throw new BadRequestException('Report execution not found');
    return this.commandBus.execute(this.buildCommand('CompleteReportExecution', 'ReportExecution', dto, req, { aggregateId: new Uuid(dto.reportExecutionId), expectedState: exec.status, expectedVersion: exec.aggregateVersion }));
  }
  @Post('report-executions/:id/commands/fail')
  async failReportExecution(@Body(new ZodValidationPipe(FailReportExecutionDtoSchema)) dto: dtos.FailReportExecutionDto, @Req() req: Request) {
    const exec = await this.reportExecutionRepo.findById(new Uuid(dto.reportExecutionId));
    if (!exec) throw new BadRequestException('Report execution not found');
    return this.commandBus.execute(this.buildCommand('FailReportExecution', 'ReportExecution', dto, req, { aggregateId: new Uuid(dto.reportExecutionId), expectedState: exec.status, expectedVersion: exec.aggregateVersion }));
  }
  @Post('report-executions/:id/commands/cancel')
  async cancelReportExecution(@Param('id') id: string, @Req() req: Request) {
    const exec = await this.reportExecutionRepo.findById(new Uuid(id));
    if (!exec) throw new BadRequestException('Report execution not found');
    return this.commandBus.execute(this.buildCommand('CancelReportExecution', 'ReportExecution', { reportExecutionId: id }, req, { aggregateId: new Uuid(id), expectedState: exec.status, expectedVersion: exec.aggregateVersion }));
  }
  @Get('report-executions')
  async listReportExecutions(@Query('reportDefinitionId') reportDefinitionId?: string) {
    if (reportDefinitionId) return this.reportExecutionRepo.findByReportDefinitionId(new Uuid(reportDefinitionId));
    return [];
  }
  @Get('report-executions/:id')
  async getReportExecution(@Param('id') id: string) {
    return this.reportExecutionRepo.findById(new Uuid(id));
  }

  @Post('report-schedules')
  async createReportSchedule(@Body(new ZodValidationPipe(CreateReportScheduleDtoSchema)) dto: dtos.CreateReportScheduleDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateReportSchedule', 'ReportSchedule', dto, req));
  }
  @Post('report-schedules/:id/commands/activate')
  async activateReportSchedule(@Param('id') id: string, @Req() req: Request) {
    const sched = await this.reportScheduleRepo.findById(new Uuid(id));
    if (!sched) throw new BadRequestException('Report schedule not found');
    return this.commandBus.execute(this.buildCommand('ActivateReportSchedule', 'ReportSchedule', { reportScheduleId: id }, req, { aggregateId: new Uuid(id), expectedState: sched.status, expectedVersion: sched.aggregateVersion }));
  }
  @Post('report-schedules/:id/commands/pause')
  async pauseReportSchedule(@Param('id') id: string, @Req() req: Request) {
    const sched = await this.reportScheduleRepo.findById(new Uuid(id));
    if (!sched) throw new BadRequestException('Report schedule not found');
    return this.commandBus.execute(this.buildCommand('PauseReportSchedule', 'ReportSchedule', { reportScheduleId: id }, req, { aggregateId: new Uuid(id), expectedState: sched.status, expectedVersion: sched.aggregateVersion }));
  }
  @Post('report-schedules/:id/commands/expire')
  async expireReportSchedule(@Param('id') id: string, @Req() req: Request) {
    const sched = await this.reportScheduleRepo.findById(new Uuid(id));
    if (!sched) throw new BadRequestException('Report schedule not found');
    return this.commandBus.execute(this.buildCommand('ExpireReportSchedule', 'ReportSchedule', { reportScheduleId: id }, req, { aggregateId: new Uuid(id), expectedState: sched.status, expectedVersion: sched.aggregateVersion }));
  }
  @Get('report-schedules')
  async listReportSchedules(@Query('reportDefinitionId') reportDefinitionId?: string) {
    if (reportDefinitionId) return this.reportScheduleRepo.findByReportDefinitionId(new Uuid(reportDefinitionId));
    return [];
  }
  @Get('report-schedules/:id')
  async getReportSchedule(@Param('id') id: string) {
    return this.reportScheduleRepo.findById(new Uuid(id));
  }

  @Post('calculated-fields')
  async createCalculatedField(@Body(new ZodValidationPipe(CreateCalculatedFieldDtoSchema)) dto: dtos.CreateCalculatedFieldDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateCalculatedField', 'CalculatedField', dto, req));
  }
  @Post('calculated-fields/:id/commands/activate')
  async activateCalculatedField(@Param('id') id: string, @Req() req: Request) {
    const cf = await this.calculatedFieldRepo.findById(new Uuid(id));
    if (!cf) throw new BadRequestException('Calculated field not found');
    return this.commandBus.execute(this.buildCommand('ActivateCalculatedField', 'CalculatedField', { calculatedFieldId: id }, req, { aggregateId: new Uuid(id), expectedState: cf.status, expectedVersion: cf.aggregateVersion }));
  }
  @Post('calculated-fields/:id/commands/deprecate')
  async deprecateCalculatedField(@Param('id') id: string, @Req() req: Request) {
    const cf = await this.calculatedFieldRepo.findById(new Uuid(id));
    if (!cf) throw new BadRequestException('Calculated field not found');
    return this.commandBus.execute(this.buildCommand('DeprecateCalculatedField', 'CalculatedField', { calculatedFieldId: id }, req, { aggregateId: new Uuid(id), expectedState: cf.status, expectedVersion: cf.aggregateVersion }));
  }
  @Get('calculated-fields')
  async listCalculatedFields(@Query('status') status?: string) {
    return this.calculatedFieldRepo.findByStatus(status ?? 'DRAFT');
  }
  @Get('calculated-fields/:id')
  async getCalculatedField(@Param('id') id: string) {
    return this.calculatedFieldRepo.findById(new Uuid(id));
  }
}
