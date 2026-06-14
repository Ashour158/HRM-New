import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the HeadcountRequest aggregate.
 *
 * States: DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, CANCELLED
 */
@Injectable()
export class HeadcountRequestFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'headcountRequest',
      states: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
      actions: ['Submit', 'StartReview', 'Approve', 'Reject', 'Cancel'],
      transitions: [
        { action: 'Submit', from: 'DRAFT', to: 'SUBMITTED', eventName: 'HeadcountRequestSubmitted' },
        { action: 'StartReview', from: 'SUBMITTED', to: 'UNDER_REVIEW', eventName: 'HeadcountRequestReviewStarted' },
        { action: 'Approve', from: 'UNDER_REVIEW', to: 'APPROVED', eventName: 'HeadcountRequestApproved' },
        { action: 'Reject', from: 'UNDER_REVIEW', to: 'REJECTED', eventName: 'HeadcountRequestRejected' },
        { action: 'Cancel', from: 'DRAFT', to: 'CANCELLED', eventName: 'HeadcountRequestCancelled' },
        { action: 'Cancel', from: 'SUBMITTED', to: 'CANCELLED', eventName: 'HeadcountRequestCancelled' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['APPROVED', 'REJECTED', 'CANCELLED'],
    });
  }
}
