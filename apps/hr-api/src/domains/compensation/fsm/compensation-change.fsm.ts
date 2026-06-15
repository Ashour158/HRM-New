import { Inject, Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for CompensationChange lifecycle management.
 *
 * States: DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED → EFFECTIVE → CANCELLED (terminal)
 *                                                              ↘ REJECTED (terminal)
 */
@Injectable()
export class CompensationChangeFsm {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'CompensationChange',
      states: ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'EFFECTIVE', 'CANCELLED', 'REJECTED'],
      actions: ['Submit', 'SendForApproval', 'Approve', 'MakeEffective', 'Reject', 'Cancel'],
      transitions: [
        { action: 'Submit', from: 'DRAFT', to: 'SUBMITTED', eventName: 'CompensationChangeSubmitted' },
        { action: 'SendForApproval', from: 'SUBMITTED', to: 'PENDING_APPROVAL', eventName: 'CompensationChangeSubmitted' },
        { action: 'Approve', from: 'PENDING_APPROVAL', to: 'APPROVED', eventName: 'CompensationChangeApproved' },
        { action: 'MakeEffective', from: 'APPROVED', to: 'EFFECTIVE', eventName: 'CompensationChangeEffective' },
        { action: 'Reject', from: 'PENDING_APPROVAL', to: 'REJECTED', eventName: 'CompensationChangeRejected' },
        { action: 'Cancel', from: 'DRAFT', to: 'CANCELLED', eventName: 'CompensationChangeCancelled' },
        { action: 'Cancel', from: 'SUBMITTED', to: 'CANCELLED', eventName: 'CompensationChangeCancelled' },
        { action: 'Cancel', from: 'PENDING_APPROVAL', to: 'CANCELLED', eventName: 'CompensationChangeCancelled' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['CANCELLED', 'REJECTED', 'EFFECTIVE'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'CompensationChange');
  }
}
