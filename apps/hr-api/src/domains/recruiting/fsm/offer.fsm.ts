import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the Offer aggregate.
 *
 * States: DRAFT, PENDING_APPROVAL, APPROVED, SENT, ACCEPTED, DECLINED, EXPIRED, WITHDRAWN
 */
@Injectable()
export class OfferFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'Offer',
      states: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN'],
      actions: [
        'SubmitOfferForApproval',
        'ApproveOffer',
        'SendOffer',
        'AcceptOffer',
        'DeclineOffer',
        'ExpireOffer',
        'WithdrawOffer',
        'UpdateOffer',
      ],
      transitions: [
        { action: 'SubmitOfferForApproval', from: 'DRAFT', to: 'PENDING_APPROVAL', eventName: 'OfferSubmitted' },
        { action: 'ApproveOffer', from: 'PENDING_APPROVAL', to: 'APPROVED', eventName: 'OfferApproved' },
        { action: 'SendOffer', from: 'APPROVED', to: 'SENT', eventName: 'OfferSent' },
        { action: 'AcceptOffer', from: 'SENT', to: 'ACCEPTED', eventName: 'OfferAccepted' },
        { action: 'DeclineOffer', from: 'SENT', to: 'DECLINED', eventName: 'OfferDeclined' },
        { action: 'ExpireOffer', from: 'SENT', to: 'EXPIRED', eventName: 'OfferExpired' },
        { action: 'WithdrawOffer', from: 'DRAFT', to: 'WITHDRAWN', eventName: 'OfferWithdrawn' },
        { action: 'WithdrawOffer', from: 'PENDING_APPROVAL', to: 'WITHDRAWN', eventName: 'OfferWithdrawn' },
        { action: 'WithdrawOffer', from: 'APPROVED', to: 'WITHDRAWN', eventName: 'OfferWithdrawn' },
        { action: 'WithdrawOffer', from: 'SENT', to: 'WITHDRAWN', eventName: 'OfferWithdrawn' },
        { action: 'UpdateOffer', from: 'DRAFT', to: 'DRAFT', eventName: 'OfferUpdated' },
        { action: 'UpdateOffer', from: 'PENDING_APPROVAL', to: 'PENDING_APPROVAL', eventName: 'OfferUpdated' },
        { action: 'UpdateOffer', from: 'APPROVED', to: 'APPROVED', eventName: 'OfferUpdated' },
        { action: 'UpdateOffer', from: 'SENT', to: 'SENT', eventName: 'OfferUpdated' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN'],
    });
  }
}
