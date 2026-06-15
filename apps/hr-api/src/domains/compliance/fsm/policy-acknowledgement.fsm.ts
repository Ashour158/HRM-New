import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the PolicyAcknowledgement aggregate.
 *
 * States: REQUIRED, ACKNOWLEDGED, OVERDUE, ESCALATED
 */
@Injectable()
export class PolicyAcknowledgementFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'PolicyAcknowledgement',
      states: ['REQUIRED', 'ACKNOWLEDGED', 'OVERDUE', 'ESCALATED'],
      actions: ['RecordPolicyAcknowledgement', 'MarkOverdue', 'EscalatePolicyAcknowledgement'],
      transitions: [
        { action: 'RecordPolicyAcknowledgement', from: 'REQUIRED', to: 'ACKNOWLEDGED', eventName: 'PolicyAcknowledged' },
        { action: 'RecordPolicyAcknowledgement', from: 'OVERDUE', to: 'ACKNOWLEDGED', eventName: 'PolicyAcknowledged' },
        { action: 'MarkOverdue', from: 'REQUIRED', to: 'OVERDUE', eventName: 'PolicyAcknowledgementOverdue' },
        { action: 'EscalatePolicyAcknowledgement', from: 'OVERDUE', to: 'ESCALATED', eventName: 'PolicyAcknowledgementEscalated' },
      ],
      initialState: 'REQUIRED',
      terminalStates: ['ACKNOWLEDGED', 'ESCALATED'],
    });
  }
}
