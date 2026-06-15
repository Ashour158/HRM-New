import { Inject, Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for BonusCycle lifecycle management.
 *
 * States: DRAFT → ACTIVE → CALCULATION → REVIEW → APPROVED → PAID → CLOSED (terminal)
 */
@Injectable()
export class BonusCycleFsm {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'BonusCycle',
      states: ['DRAFT', 'ACTIVE', 'CALCULATION', 'REVIEW', 'APPROVED', 'PAID', 'CLOSED'],
      actions: ['Activate', 'StartCalculation', 'StartReview', 'Approve', 'MarkPaid', 'Close'],
      transitions: [
        { action: 'Activate', from: 'DRAFT', to: 'ACTIVE', eventName: 'BonusCycleActivated' },
        { action: 'StartCalculation', from: 'ACTIVE', to: 'CALCULATION', eventName: 'BonusCycleCalculated' },
        { action: 'StartReview', from: 'CALCULATION', to: 'REVIEW', eventName: 'BonusCycleReviewed' },
        { action: 'Approve', from: 'REVIEW', to: 'APPROVED', eventName: 'BonusCycleApproved' },
        { action: 'MarkPaid', from: 'APPROVED', to: 'PAID', eventName: 'BonusCyclePaid' },
        { action: 'Close', from: 'PAID', to: 'CLOSED', eventName: 'BonusCycleClosed' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['CLOSED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'BonusCycle');
  }
}
