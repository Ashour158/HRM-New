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
  FailReportExecutionDtoSchema, CreateReportScheduleDtoSchema, CreateCalculatedFieldDtoSchema, HrAnalyticsQueryDtoSchema,
  GetReportFilterOptionsDtoSchema, PreviewReportDefinitionDtoSchema, RunReportAnalyticsDtoSchema, RunReportDefinitionDtoSchema,
  RunSemanticReportQueryDtoSchema, RunSmartAnalyticsCategoryDtoSchema, ZodValidationPipe,
} from './dtos.js';
import { ServiceUsageReportingService } from '../services/service-usage-reporting.service.js';
import { HrAnalyticsReportingService } from '../services/hr-analytics-reporting.service.js';
import { ReportBuilderCatalogService } from '../services/report-builder-catalog.service.js';
import { ReportSemanticQueryService } from '../services/report-semantic-query.service.js';
import { DocumentExportService, EXPORT_CONTENT_TYPES, type ExportFormat } from '../../../platform/export/document-export.service.js';
import {
  buildEmployeeImportTemplateCsv,
  buildHrDashboardExportCsv,
  buildModuleImportTemplateCsv,
  buildModuleMigrationManifestCsv,
  isMigrationTemplateModule,
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
    private readonly hrAnalyticsReporting: HrAnalyticsReportingService,
    private readonly reportBuilderCatalog: ReportBuilderCatalogService,
    private readonly semanticQuery: ReportSemanticQueryService,
    private readonly documentExport: DocumentExportService,
  ) {}

  private buildCommand<TPayload>(
    commandName: string, aggregateType: string, payload: TPayload, req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = this.getTenantId(req);
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
  @Get('builder/catalog')
  async getReportBuilderCatalog(@Req() req: Request) {
    this.assertReportingAdmin(req);
    return this.reportBuilderCatalog.getCatalog();
  }
  @Post('report-definitions/preview')
  async previewReportDefinition(@Body(new ZodValidationPipe(PreviewReportDefinitionDtoSchema)) dto: dtos.PreviewReportDefinitionDto, @Req() req: Request) {
    this.assertReportingAdmin(req);
    return this.reportBuilderCatalog.previewDefinition(dto);
  }
  @Post('builder/analytics-packs/run')
  async runReportAnalyticsPack(@Body(new ZodValidationPipe(RunReportAnalyticsDtoSchema)) dto: dtos.RunReportAnalyticsDto, @Req() req: Request) {
    this.assertReportingAdmin(req);
    return this.reportBuilderCatalog.runAnalyticsPack(dto);
  }
  @Post('builder/smart-categories/run')
  async runSmartAnalyticsCategory(@Body(new ZodValidationPipe(RunSmartAnalyticsCategoryDtoSchema)) dto: dtos.RunSmartAnalyticsCategoryDto, @Req() req: Request) {
    this.assertReportingAdmin(req);
    return this.reportBuilderCatalog.runSmartCategory(dto);
  }
  @Post('builder/query/run')
  async runSemanticReportQuery(@Body(new ZodValidationPipe(RunSemanticReportQueryDtoSchema)) dto: dtos.RunSemanticReportQueryDto, @Req() req: Request) {
    this.assertReportingAdmin(req);
    return this.semanticQuery.run({ ...dto, tenantId: this.getTenantId(req).value });
  }
  @Post('builder/query/export')
  async exportSemanticReportQuery(
    @Query('format') format: string,
    @Body(new ZodValidationPipe(RunSemanticReportQueryDtoSchema)) dto: dtos.RunSemanticReportQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.assertReportingAdmin(req);
    const normalized = (format ?? 'xlsx').toLowerCase();
    if (normalized !== 'xlsx' && normalized !== 'pdf' && normalized !== 'docx') {
      throw new BadRequestException('format must be one of: xlsx, pdf, docx');
    }
    const exportFormat = normalized as ExportFormat;
    const result = await this.semanticQuery.run({ ...dto, tenantId: this.getTenantId(req).value });
    const generatedAt = new Date().toISOString();
    const buffer = await this.documentExport.render({
      title: dto.dataSource ?? 'Report',
      columns: result.columns,
      rows: result.rows.map((row) => result.columns.map((col) => row[col] ?? '')),
      generatedAt,
    }, exportFormat);
    res.setHeader('Content-Type', EXPORT_CONTENT_TYPES[exportFormat]);
    res.setHeader('Content-Disposition', `attachment; filename="report.${exportFormat}"`);
    return res.send(buffer);
  }

  @Post('builder/filter-options')
  async getBuilderFilterOptions(@Body(new ZodValidationPipe(GetReportFilterOptionsDtoSchema)) dto: dtos.GetReportFilterOptionsDto, @Req() req: Request) {
    this.assertReportingAdmin(req);
    return this.semanticQuery.getFilterOptions({ ...dto, tenantId: this.getTenantId(req).value });
  }
  @Post('report-definitions/:id/commands/run')
  async runReportDefinition(@Param('id') id: string, @Body(new ZodValidationPipe(RunReportDefinitionDtoSchema)) dto: dtos.RunReportDefinitionDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('RunReportDefinition', 'ReportDefinition', {
      ...dto,
      reportDefinitionId: id,
    }, req, { aggregateId: new Uuid(id) }));
  }
  @Post('report-definitions/:id/commands/publish')
  async publishReportDefinition(@Param('id') id: string, @Req() req: Request) {
    const doc = await this.reportDefinitionRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!doc) throw new BadRequestException('Report definition not found');
    return this.commandBus.execute(this.buildCommand('PublishReportDefinition', 'ReportDefinition', { reportDefinitionId: id }, req, { aggregateId: new Uuid(id), expectedState: doc.status, expectedVersion: doc.aggregateVersion }));
  }
  @Post('report-definitions/:id/commands/archive')
  async archiveReportDefinition(@Param('id') id: string, @Req() req: Request) {
    const doc = await this.reportDefinitionRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!doc) throw new BadRequestException('Report definition not found');
    return this.commandBus.execute(this.buildCommand('ArchiveReportDefinition', 'ReportDefinition', { reportDefinitionId: id }, req, { aggregateId: new Uuid(id), expectedState: doc.status, expectedVersion: doc.aggregateVersion }));
  }
  @Get('report-definitions')
  async listReportDefinitions(@Req() req: Request, @Query('status') status?: string) {
    this.assertReportingAdmin(req);
    if (!status || status === 'ALL') {
      const tenantId = this.getTenantId(req);
      const groups = await Promise.all(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'DEPRECATED'].map((state) => this.reportDefinitionRepo.findByStatusForTenant(state, tenantId)));
      return groups.flat();
    }
    return this.reportDefinitionRepo.findByStatusForTenant(status, this.getTenantId(req));
  }
  @Get('report-definitions/:id')
  async getReportDefinition(@Req() req: Request, @Param('id') id: string) {
    this.assertReportingAdmin(req);
    return this.reportDefinitionRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
  }

  @Post('report-executions')
  async createReportExecution(@Body(new ZodValidationPipe(CreateReportExecutionDtoSchema)) dto: dtos.CreateReportExecutionDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateReportExecution', 'ReportExecution', dto, req));
  }
  @Post('report-executions/:id/commands/queue')
  async queueReportExecution(@Param('id') id: string, @Req() req: Request) {
    const exec = await this.reportExecutionRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!exec) throw new BadRequestException('Report execution not found');
    return this.commandBus.execute(this.buildCommand('QueueReportExecution', 'ReportExecution', { reportExecutionId: id }, req, { aggregateId: new Uuid(id), expectedState: exec.status, expectedVersion: exec.aggregateVersion }));
  }
  @Post('report-executions/:id/commands/start')
  async startReportExecution(@Param('id') id: string, @Req() req: Request) {
    const exec = await this.reportExecutionRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!exec) throw new BadRequestException('Report execution not found');
    return this.commandBus.execute(this.buildCommand('StartReportExecution', 'ReportExecution', { reportExecutionId: id }, req, { aggregateId: new Uuid(id), expectedState: exec.status, expectedVersion: exec.aggregateVersion }));
  }
  @Post('report-executions/:id/commands/complete')
  async completeReportExecution(@Body(new ZodValidationPipe(CompleteReportExecutionDtoSchema)) dto: dtos.CompleteReportExecutionDto, @Req() req: Request) {
    const exec = await this.reportExecutionRepo.findByIdForTenant(new Uuid(dto.reportExecutionId), this.getTenantId(req));
    if (!exec) throw new BadRequestException('Report execution not found');
    return this.commandBus.execute(this.buildCommand('CompleteReportExecution', 'ReportExecution', dto, req, { aggregateId: new Uuid(dto.reportExecutionId), expectedState: exec.status, expectedVersion: exec.aggregateVersion }));
  }
  @Post('report-executions/:id/commands/fail')
  async failReportExecution(@Body(new ZodValidationPipe(FailReportExecutionDtoSchema)) dto: dtos.FailReportExecutionDto, @Req() req: Request) {
    const exec = await this.reportExecutionRepo.findByIdForTenant(new Uuid(dto.reportExecutionId), this.getTenantId(req));
    if (!exec) throw new BadRequestException('Report execution not found');
    return this.commandBus.execute(this.buildCommand('FailReportExecution', 'ReportExecution', dto, req, { aggregateId: new Uuid(dto.reportExecutionId), expectedState: exec.status, expectedVersion: exec.aggregateVersion }));
  }
  @Post('report-executions/:id/commands/cancel')
  async cancelReportExecution(@Param('id') id: string, @Req() req: Request) {
    const exec = await this.reportExecutionRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!exec) throw new BadRequestException('Report execution not found');
    return this.commandBus.execute(this.buildCommand('CancelReportExecution', 'ReportExecution', { reportExecutionId: id }, req, { aggregateId: new Uuid(id), expectedState: exec.status, expectedVersion: exec.aggregateVersion }));
  }
  @Get('report-executions')
  async listReportExecutions(@Req() req: Request, @Query('reportDefinitionId') reportDefinitionId?: string) {
    this.assertReportingAdmin(req);
    if (reportDefinitionId) return this.reportExecutionRepo.findByReportDefinitionIdForTenant(new Uuid(reportDefinitionId), this.getTenantId(req));
    return this.reportExecutionRepo.findRecentForTenant(this.getTenantId(req));
  }
  @Get('report-executions/:id')
  async getReportExecution(@Req() req: Request, @Param('id') id: string) {
    this.assertReportingAdmin(req);
    return this.reportExecutionRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
  }

  @Post('report-schedules')
  async createReportSchedule(@Body(new ZodValidationPipe(CreateReportScheduleDtoSchema)) dto: dtos.CreateReportScheduleDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateReportSchedule', 'ReportSchedule', dto, req));
  }
  @Post('report-schedules/:id/commands/activate')
  async activateReportSchedule(@Param('id') id: string, @Req() req: Request) {
    const sched = await this.reportScheduleRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!sched) throw new BadRequestException('Report schedule not found');
    return this.commandBus.execute(this.buildCommand('ActivateReportSchedule', 'ReportSchedule', { reportScheduleId: id }, req, { aggregateId: new Uuid(id), expectedState: sched.status, expectedVersion: sched.aggregateVersion }));
  }
  @Post('report-schedules/:id/commands/pause')
  async pauseReportSchedule(@Param('id') id: string, @Req() req: Request) {
    const sched = await this.reportScheduleRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!sched) throw new BadRequestException('Report schedule not found');
    return this.commandBus.execute(this.buildCommand('PauseReportSchedule', 'ReportSchedule', { reportScheduleId: id }, req, { aggregateId: new Uuid(id), expectedState: sched.status, expectedVersion: sched.aggregateVersion }));
  }
  @Post('report-schedules/:id/commands/expire')
  async expireReportSchedule(@Param('id') id: string, @Req() req: Request) {
    const sched = await this.reportScheduleRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!sched) throw new BadRequestException('Report schedule not found');
    return this.commandBus.execute(this.buildCommand('ExpireReportSchedule', 'ReportSchedule', { reportScheduleId: id }, req, { aggregateId: new Uuid(id), expectedState: sched.status, expectedVersion: sched.aggregateVersion }));
  }
  @Get('report-schedules')
  async listReportSchedules(@Req() req: Request, @Query('reportDefinitionId') reportDefinitionId?: string) {
    this.assertReportingAdmin(req);
    if (reportDefinitionId) return this.reportScheduleRepo.findByReportDefinitionIdForTenant(new Uuid(reportDefinitionId), this.getTenantId(req));
    return [];
  }
  @Get('report-schedules/:id')
  async getReportSchedule(@Req() req: Request, @Param('id') id: string) {
    this.assertReportingAdmin(req);
    return this.reportScheduleRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
  }

  @Post('calculated-fields')
  async createCalculatedField(@Body(new ZodValidationPipe(CreateCalculatedFieldDtoSchema)) dto: dtos.CreateCalculatedFieldDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateCalculatedField', 'CalculatedField', dto, req));
  }
  @Post('calculated-fields/:id/commands/activate')
  async activateCalculatedField(@Param('id') id: string, @Req() req: Request) {
    const cf = await this.calculatedFieldRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!cf) throw new BadRequestException('Calculated field not found');
    return this.commandBus.execute(this.buildCommand('ActivateCalculatedField', 'CalculatedField', { calculatedFieldId: id }, req, { aggregateId: new Uuid(id), expectedState: cf.status, expectedVersion: cf.aggregateVersion }));
  }
  @Post('calculated-fields/:id/commands/deprecate')
  async deprecateCalculatedField(@Param('id') id: string, @Req() req: Request) {
    const cf = await this.calculatedFieldRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!cf) throw new BadRequestException('Calculated field not found');
    return this.commandBus.execute(this.buildCommand('DeprecateCalculatedField', 'CalculatedField', { calculatedFieldId: id }, req, { aggregateId: new Uuid(id), expectedState: cf.status, expectedVersion: cf.aggregateVersion }));
  }
  @Get('calculated-fields')
  async listCalculatedFields(@Req() req: Request, @Query('status') status?: string) {
    this.assertReportingAdmin(req);
    if (status === 'ALL') {
      const tenantId = this.getTenantId(req);
      const groups = await Promise.all(['DRAFT', 'ACTIVE', 'DEPRECATED'].map((state) => this.calculatedFieldRepo.findByStatusForTenant(state, tenantId)));
      return groups.flat();
    }
    return this.calculatedFieldRepo.findByStatusForTenant(status ?? 'DRAFT', this.getTenantId(req));
  }
  @Get('calculated-fields/:id')
  async getCalculatedField(@Req() req: Request, @Param('id') id: string) {
    this.assertReportingAdmin(req);
    return this.calculatedFieldRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
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

  @Get('hr-analytics')
  async getHrAnalyticsDashboard(
    @Req() req: Request,
    @Query(new ZodValidationPipe(HrAnalyticsQueryDtoSchema)) query: dtos.HrAnalyticsQueryDto = {},
  ) {
    this.assertReportingAdmin(req);
    return this.hrAnalyticsReporting.getDashboard(this.getTenantId(req), {
      from: this.parseOptionalDate('from', query.from),
      to: this.parseOptionalDate('to', query.to),
    });
  }

  @Get('employee-import-template.csv')
  async getEmployeeImportTemplate(@Req() req: Request, @Res() res: Response) {
    this.assertReportingAdmin(req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="employee-import-template.csv"');
    return res.send(buildEmployeeImportTemplateCsv());
  }

  @Get('module-import-template.csv')
  async getModuleImportTemplate(
    @Req() req: Request,
    @Res() res: Response,
    @Query('module') module = 'employees',
  ) {
    this.assertReportingAdmin(req);
    if (!isMigrationTemplateModule(module)) {
      throw new BadRequestException(`Unknown migration module: ${module}`);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${module}-import-template.csv"`);
    return res.send(buildModuleImportTemplateCsv(module));
  }

  @Get('migration-manifest/export.csv')
  async exportMigrationManifestCsv(@Req() req: Request, @Res() res: Response) {
    this.assertReportingAdmin(req);
    const protocol = req.protocol ?? 'http';
    const host = req.get?.('host');
    const apiBaseUrl = host ? `${protocol}://${host}` : '';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="hr-migration-manifest.csv"');
    return res.send(buildModuleMigrationManifestCsv(apiBaseUrl));
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
