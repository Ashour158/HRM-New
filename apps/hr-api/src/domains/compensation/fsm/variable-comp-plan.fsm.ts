import { Inject, Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for VariableCompPlan lifecycle management.
 *
 * States: DRAFT → ACTIVE → CLOSED (terminal)
 */
@Injectable()
export class VariableCompPlanFsm {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'VariableCompPlan',
      states: ['DRAFT', 'ACTIVE', 'CLOSED'],
      actions: ['Activate', 'Close'],
      transitions: [
        { action: 'Activate', from: 'DRAFT', to: 'ACTIVE', eventName: 'VariableCompPlanActivated' },
        { action: 'Close', from: 'ACTIVE', to: 'CLOSED', eventName: 'VariableCompPlanClosed' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['CLOSED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'VariableCompPlan');
  }
}
