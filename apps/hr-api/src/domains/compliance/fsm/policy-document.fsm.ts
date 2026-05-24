import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the PolicyDocument aggregate.
 *
 * States: DRAFT, PENDING_APPROVAL, APPROVED, PUBLISHED, ARCHIVED, REJECTED
 */
@Injectable()
export class PolicyDocumentFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'PolicyDocument',
      states: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'REJECTED'],
      actions: [
        'SubmitForApproval',
        'ApprovePolicyDocument',
        'RejectPolicyDocument',
        'PublishPolicyDocument',
        'ArchivePolicyDocument',
      ],
      transitions: [
        { action: 'SubmitForApproval', from: 'DRAFT', to: 'PENDING_APPROVAL', eventName: 'PolicyDocumentSubmitted' },
        { action: 'ApprovePolicyDocument', from: 'PENDING_APPROVAL', to: 'APPROVED', eventName: 'PolicyDocumentApproved' },
        { action: 'RejectPolicyDocument', from: 'PENDING_APPROVAL', to: 'REJECTED', eventName: 'PolicyDocumentRejected' },
        { action: 'PublishPolicyDocument', from: 'APPROVED', to: 'PUBLISHED', eventName: 'PolicyDocumentPublished' },
        { action: 'ArchivePolicyDocument', from: 'PUBLISHED', to: 'ARCHIVED', eventName: 'PolicyDocumentArchived' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['ARCHIVED', 'REJECTED'],
    });
  }
}
