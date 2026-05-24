import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class PayEquityReviewFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'PayEquityReview',
      states: ['PLANNED', 'IN_PROGRESS', 'FINDINGS', 'REMEDIATION', 'CLOSED'],
      actions: ['StartPayEquityReview', 'RecordPayEquityFindings', 'StartPayEquityRemediation', 'ClosePayEquityReview'],
      transitions: [
        { action: 'StartPayEquityReview', from: 'PLANNED', to: 'IN_PROGRESS', eventName: 'PayEquityReviewStarted' },
        { action: 'RecordPayEquityFindings', from: 'IN_PROGRESS', to: 'FINDINGS', eventName: 'PayEquityReviewFindings' },
        { action: 'StartPayEquityRemediation', from: 'FINDINGS', to: 'REMEDIATION', eventName: 'PayEquityReviewRemediation' },
        { action: 'ClosePayEquityReview', from: 'REMEDIATION', to: 'CLOSED', eventName: 'PayEquityReviewClosed' },
        { action: 'ClosePayEquityReview', from: 'FINDINGS', to: 'CLOSED', eventName: 'PayEquityReviewClosed' },
      ],
      initialState: 'PLANNED',
      terminalStates: ['CLOSED'],
    });
  }
}
