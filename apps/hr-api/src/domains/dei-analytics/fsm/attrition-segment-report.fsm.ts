import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class AttritionSegmentReportFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'AttritionSegmentReport',
      states: ['DRAFT', 'GENERATED', 'PUBLISHED', 'ARCHIVED'],
      actions: ['GenerateAttritionSegmentReport', 'PublishAttritionSegmentReport', 'ArchiveAttritionSegmentReport'],
      transitions: [
        { action: 'GenerateAttritionSegmentReport', from: 'DRAFT', to: 'GENERATED', eventName: 'AttritionSegmentReportGenerated' },
        { action: 'PublishAttritionSegmentReport', from: 'GENERATED', to: 'PUBLISHED', eventName: 'AttritionSegmentReportPublished' },
        { action: 'ArchiveAttritionSegmentReport', from: 'PUBLISHED', to: 'ARCHIVED', eventName: 'AttritionSegmentReportArchived' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['ARCHIVED'],
    });
  }
}
