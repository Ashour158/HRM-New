import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the WorkAuthorizationCase aggregate.
 *
 * States: OPEN, UNDER_REVIEW, APPROVED, EXPIRED, RENEWED, CLOSED, REJECTED
 */
@Injectable()
export class WorkAuthorizationCaseFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'WorkAuthorizationCase',
      states: ['OPEN', 'UNDER_REVIEW', 'APPROVED', 'EXPIRED', 'RENEWED', 'CLOSED', 'REJECTED'],
      actions: [
        'StartWorkAuthorizationReview',
        'ApproveWorkAuthorizationCase',
        'ExpireWorkAuthorizationCase',
        'RenewWorkAuthorizationCase',
        'CloseWorkAuthorizationCase',
        'RejectWorkAuthorizationCase',
      ],
      transitions: [
        { action: 'StartWorkAuthorizationReview', from: 'OPEN', to: 'UNDER_REVIEW', eventName: 'WorkAuthorizationReviewStarted' },
        { action: 'ApproveWorkAuthorizationCase', from: 'UNDER_REVIEW', to: 'APPROVED', eventName: 'WorkAuthorizationCaseApproved' },
        { action: 'ExpireWorkAuthorizationCase', from: 'APPROVED', to: 'EXPIRED', eventName: 'WorkAuthorizationCaseExpired' },
        { action: 'ExpireWorkAuthorizationCase', from: 'RENEWED', to: 'EXPIRED', eventName: 'WorkAuthorizationCaseExpired' },
        { action: 'RenewWorkAuthorizationCase', from: 'EXPIRED', to: 'RENEWED', eventName: 'WorkAuthorizationCaseRenewed' },
        { action: 'RenewWorkAuthorizationCase', from: 'APPROVED', to: 'RENEWED', eventName: 'WorkAuthorizationCaseRenewed' },
        { action: 'CloseWorkAuthorizationCase', from: 'APPROVED', to: 'CLOSED', eventName: 'WorkAuthorizationCaseClosed' },
        { action: 'CloseWorkAuthorizationCase', from: 'EXPIRED', to: 'CLOSED', eventName: 'WorkAuthorizationCaseClosed' },
        { action: 'CloseWorkAuthorizationCase', from: 'RENEWED', to: 'CLOSED', eventName: 'WorkAuthorizationCaseClosed' },
        { action: 'RejectWorkAuthorizationCase', from: 'UNDER_REVIEW', to: 'REJECTED', eventName: 'WorkAuthorizationCaseRejected' },
      ],
      initialState: 'OPEN',
      terminalStates: ['CLOSED', 'REJECTED'],
    });
  }
}
