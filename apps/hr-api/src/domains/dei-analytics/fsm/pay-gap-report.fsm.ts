import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class PayGapReportFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'PayGapReport',
      states: ['DRAFT', 'CALCULATED', 'REVIEWED', 'PUBLISHED', 'ARCHIVED'],
      actions: ['CalculatePayGapReport', 'ReviewPayGapReport', 'PublishPayGapReport', 'ArchivePayGapReport'],
      transitions: [
        { action: 'CalculatePayGapReport', from: 'DRAFT', to: 'CALCULATED', eventName: 'PayGapReportCalculated' },
        { action: 'ReviewPayGapReport', from: 'CALCULATED', to: 'REVIEWED', eventName: 'PayGapReportReviewed' },
        { action: 'PublishPayGapReport', from: 'REVIEWED', to: 'PUBLISHED', eventName: 'PayGapReportPublished' },
        { action: 'ArchivePayGapReport', from: 'PUBLISHED', to: 'ARCHIVED', eventName: 'PayGapReportArchived' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['ARCHIVED'],
    });
  }
}
