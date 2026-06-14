import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class DeiReportFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'DeiReport',
      states: ['DRAFT', 'GENERATED', 'REVIEWED', 'PUBLISHED', 'ARCHIVED'],
      actions: ['GenerateDeiReport', 'ReviewDeiReport', 'PublishDeiReport', 'ArchiveDeiReport'],
      transitions: [
        { action: 'GenerateDeiReport', from: 'DRAFT', to: 'GENERATED', eventName: 'DeiReportGenerated' },
        { action: 'ReviewDeiReport', from: 'GENERATED', to: 'REVIEWED', eventName: 'DeiReportReviewed' },
        { action: 'PublishDeiReport', from: 'REVIEWED', to: 'PUBLISHED', eventName: 'DeiReportPublished' },
        { action: 'ArchiveDeiReport', from: 'PUBLISHED', to: 'ARCHIVED', eventName: 'DeiReportArchived' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['ARCHIVED'],
    });
  }
}
