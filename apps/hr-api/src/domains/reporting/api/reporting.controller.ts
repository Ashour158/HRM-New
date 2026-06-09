import { Controller, Get, Post, Body, Param, Query, Req, Res, BadRequestException, ForbiddenException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { ReportDefinitionRepository } from '../repositories/report-definition.repository.js';
import { ReportExecutionRepository } from '../repositories/report-execution.repository.js';
import { ReportScheduleRepository } from '../repositories/report-schedule.repository.js';
import { CalculatedFieldRepository } from '../repositories/calculated-field.repository.js';
import type * as dtos from './dtos.js';
import {
  CreateReportDefinitionDtoSchema, CreateReportExecutionDtoSchema, CompleteReportExecutionDtoSchema,
  FailReportExecutionDtoSchema, CreateReportScheduleDtoSchema, CreateCalculatedFieldDtoSchema, ZodValidationPipe,
} from './dtos.js';
import { ServiceUsageReportingService } from '../services/service-usage-reporting.service.js';
import {
  buildEmployeeImportTemplateCsv,
  buildHrDashboardExportCsv,
} from '../services/employee-import-export-template.service.js';

const REPORTING_ADMIN_ROLES = new Set(['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN', 'HRBP', 'REPORTING_ADMIN', 'HR_ANALYST']);

@ApiTags('Reporting')
@UseGuards(AuthGuard)
@Controller('reporting')
export class ReportingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly reportDefinitionRepo: ReportDefinitionRepository,
    private readonly reportExecutionRepo: ReportExecutionRepository,
    private readonly reportScheduleRepo: ReportScheduleRepository,
    private readonly calculatedFieldRepo: CalculatedFieldRepository,
    private readonly serviceUsageReporting: ServiceUsageReportingService,
  ) {}

  private buildCommand<TPayload>(
    commandName: string, aggregateType: string, payload: TPayload, req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    const actor = req.actor;
    if (!actor) throw new ForbiddenException('Reporting commands require an authenticated actor');
    if (!actor.roles.some((role) => REPORTING_ADMIN_ROLES.has(role))) {
      throw new ForbiddenException('Only reporting administrators can manage report definitions and executions');
    }
    return {
      commandId: Uuid.generate(), commandName, commandSchemaVersion: 1, tenantId,
      actor,
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

  @Get('service-usage/summary')
  async getServiceUsageSummary(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertReportingAdmin(req);
    return this.serviceUsageReporting.getSummary(this.getTenantId(req), {
      from: this.parseOptionalDate('from', from),
      to: this.parseOptionalDate('to', to),
    });
  }

  @Get('service-usage')
  async getServiceUsage(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.getServiceUsageSummary(req, from, to);
  }

  @Get('hr-dashboard')
  async getHrDashboard(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertReportingAdmin(req);
    return this.serviceUsageReporting.getHrDashboard(this.getTenantId(req), {
      from: this.parseOptionalDate('from', from),
      to: this.parseOptionalDate('to', to),
    });
  }

  @Get('employee-import-template.csv')
  async getEmployeeImportTemplate(@Req() req: Request, @Res() res: Response) {
    this.assertReportingAdmin(req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="employee-import-template.csv"');
    return res.send(buildEmployeeImportTemplateCsv());
  }

  @Get('hr-dashboard/export.csv')
  async exportHrDashboardCsv(
    @Req() req: Request,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertReportingAdmin(req);
    const dashboard = await this.serviceUsageReporting.getHrDashboard(this.getTenantId(req), {
      from: this.parseOptionalDate('from', from),
      to: this.parseOptionalDate('to', to),
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="hr-reporting-dashboard.csv"');
    return res.send(buildHrDashboardExportCsv(dashboard));
  }

  private getTenantId(req: Request): Uuid {
    const tenantId = req.tenantId as string | undefined;
    if (!tenantId || !Uuid.isValid(tenantId)) {
      throw new ForbiddenException('Reporting requires an authenticated tenant');
    }
    return new Uuid(tenantId);
  }

  private assertReportingAdmin(req: Request): void {
    const actor = req.actor;
    if (!actor || !actor.roles.some((role) => REPORTING_ADMIN_ROLES.has(role))) {
      throw new ForbiddenException('Only reporting administrators can access service usage reporting');
    }
  }

  private parseOptionalDate(field: string, value?: string): Date | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return parsed;
  }
}
