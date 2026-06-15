import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class ReportDefinitionFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'ReportDefinition',
      states: ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'DEPRECATED'],
      actions: ['PublishReportDefinition', 'ArchiveReportDefinition', 'DeprecateReportDefinition'],
      transitions: [
        { action: 'PublishReportDefinition', from: 'DRAFT', to: 'PUBLISHED', eventName: 'ReportDefinitionPublished' },
        { action: 'ArchiveReportDefinition', from: 'PUBLISHED', to: 'ARCHIVED', eventName: 'ReportDefinitionArchived' },
        { action: 'DeprecateReportDefinition', from: 'DRAFT', to: 'DEPRECATED', eventName: 'ReportDefinitionDeprecated' },
        { action: 'DeprecateReportDefinition', from: 'PUBLISHED', to: 'DEPRECATED', eventName: 'ReportDefinitionDeprecated' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['ARCHIVED', 'DEPRECATED'],
    });
  }
}
