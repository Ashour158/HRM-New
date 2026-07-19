import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { ReportingController } from './api/reporting.controller.js';
import { ReportDefinitionFsmRegistrar } from './fsm/report-definition.fsm.js';
import { ReportExecutionFsmRegistrar } from './fsm/report-execution.fsm.js';
import { ReportScheduleFsmRegistrar } from './fsm/report-schedule.fsm.js';
import { CalculatedFieldFsmRegistrar } from './fsm/calculated-field.fsm.js';
import { ReportDefinitionRepository } from './repositories/report-definition.repository.js';
import { ReportExecutionRepository } from './repositories/report-execution.repository.js';
import { ReportScheduleRepository } from './repositories/report-schedule.repository.js';
import { CalculatedFieldRepository } from './repositories/calculated-field.repository.js';
import { CreateReportDefinitionHandler } from './commands/create-report-definition.handler.js';
import { PublishReportDefinitionHandler } from './commands/publish-report-definition.handler.js';
import { ArchiveReportDefinitionHandler } from './commands/archive-report-definition.handler.js';
import { CreateReportExecutionHandler } from './commands/create-report-execution.handler.js';
import { RunReportDefinitionHandler } from './commands/run-report-definition.handler.js';
import { QueueReportExecutionHandler } from './commands/queue-report-execution.handler.js';
import { StartReportExecutionHandler } from './commands/start-report-execution.handler.js';
import { CompleteReportExecutionHandler } from './commands/complete-report-execution.handler.js';
import { FailReportExecutionHandler } from './commands/fail-report-execution.handler.js';
import { CancelReportExecutionHandler } from './commands/cancel-report-execution.handler.js';
import { CreateReportScheduleHandler } from './commands/create-report-schedule.handler.js';
import { ActivateReportScheduleHandler } from './commands/activate-report-schedule.handler.js';
import { PauseReportScheduleHandler } from './commands/pause-report-schedule.handler.js';
import { ExpireReportScheduleHandler } from './commands/expire-report-schedule.handler.js';
import { RecordReportScheduleRunHandler } from './commands/record-report-schedule-run.handler.js';
import { CreateCalculatedFieldHandler } from './commands/create-calculated-field.handler.js';
import { ActivateCalculatedFieldHandler } from './commands/activate-calculated-field.handler.js';
import { DeprecateCalculatedFieldHandler } from './commands/deprecate-calculated-field.handler.js';
import { ReportingEventsPublisher } from './events/reporting-events.publisher.js';
import { ServiceUsageReportingService } from './services/service-usage-reporting.service.js';
import { HrAnalyticsReportingService } from './services/hr-analytics-reporting.service.js';
import { ReportBuilderCatalogService } from './services/report-builder-catalog.service.js';
import { ReportSemanticQueryService } from './services/report-semantic-query.service.js';
import { SEMANTIC_REPORT_ROW_PROVIDER, SqlSemanticReportRowProviderService } from './services/report-semantic-row-provider.service.js';
import { DocumentExportService } from '../../platform/export/document-export.service.js';

@Module({
  imports: [PlatformModule],
  controllers: [ReportingController],
  providers: [
    ReportDefinitionFsmRegistrar, ReportExecutionFsmRegistrar, ReportScheduleFsmRegistrar, CalculatedFieldFsmRegistrar,
    ReportDefinitionRepository, ReportExecutionRepository, ReportScheduleRepository, CalculatedFieldRepository,
    CreateReportDefinitionHandler, PublishReportDefinitionHandler, ArchiveReportDefinitionHandler,
    CreateReportExecutionHandler, RunReportDefinitionHandler, QueueReportExecutionHandler, StartReportExecutionHandler, CompleteReportExecutionHandler, FailReportExecutionHandler, CancelReportExecutionHandler,
    CreateReportScheduleHandler, ActivateReportScheduleHandler, PauseReportScheduleHandler, ExpireReportScheduleHandler, RecordReportScheduleRunHandler,
    CreateCalculatedFieldHandler, ActivateCalculatedFieldHandler, DeprecateCalculatedFieldHandler,
    ReportingEventsPublisher, ServiceUsageReportingService, HrAnalyticsReportingService, ReportBuilderCatalogService, ReportSemanticQueryService,
    SqlSemanticReportRowProviderService,
    { provide: SEMANTIC_REPORT_ROW_PROVIDER, useExisting: SqlSemanticReportRowProviderService },
    DocumentExportService,
  ],
  exports: [ReportDefinitionRepository, ReportExecutionRepository, ReportScheduleRepository, CalculatedFieldRepository, ServiceUsageReportingService, HrAnalyticsReportingService, ReportBuilderCatalogService, ReportSemanticQueryService],
})
export class ReportingModule {}
