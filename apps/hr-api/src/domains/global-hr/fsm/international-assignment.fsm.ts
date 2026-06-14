import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class InternationalAssignmentFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'InternationalAssignment',
      states: ['DRAFT', 'APPROVED', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED'],
      actions: [
        'ApproveInternationalAssignment',
        'ActivateInternationalAssignment',
        'CompleteInternationalAssignment',
        'ExpireInternationalAssignment',
        'CancelInternationalAssignment',
      ],
      transitions: [
        { action: 'ApproveInternationalAssignment', from: 'DRAFT', to: 'APPROVED', eventName: 'InternationalAssignmentApproved' },
        { action: 'ActivateInternationalAssignment', from: 'APPROVED', to: 'ACTIVE', eventName: 'InternationalAssignmentActivated' },
        { action: 'CompleteInternationalAssignment', from: 'ACTIVE', to: 'COMPLETED', eventName: 'InternationalAssignmentCompleted' },
        { action: 'ExpireInternationalAssignment', from: 'APPROVED', to: 'EXPIRED', eventName: 'InternationalAssignmentExpired' },
        { action: 'ExpireInternationalAssignment', from: 'ACTIVE', to: 'EXPIRED', eventName: 'InternationalAssignmentExpired' },
        { action: 'CancelInternationalAssignment', from: 'DRAFT', to: 'CANCELLED', eventName: 'InternationalAssignmentCancelled' },
        { action: 'CancelInternationalAssignment', from: 'APPROVED', to: 'CANCELLED', eventName: 'InternationalAssignmentCancelled' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['COMPLETED', 'EXPIRED', 'CANCELLED'],
    });
  }
}
