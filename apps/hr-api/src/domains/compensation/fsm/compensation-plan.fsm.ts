import { Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for CompensationPlan lifecycle management.
 *
 * States: DRAFT → ACTIVE → SUSPENDED → CLOSED (terminal)
 */
@Injectable()
export class CompensationPlanFsm {
  constructor(private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'CompensationPlan',
      states: ['DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED'],
      actions: ['Activate', 'Suspend', 'Close'],
      transitions: [
        { action: 'Activate', from: 'DRAFT', to: 'ACTIVE', eventName: 'CompensationPlanActivated' },
        { action: 'Activate', from: 'SUSPENDED', to: 'ACTIVE', eventName: 'CompensationPlanActivated' },
        { action: 'Suspend', from: 'ACTIVE', to: 'SUSPENDED', eventName: 'CompensationPlanSuspended' },
        { action: 'Close', from: 'ACTIVE', to: 'CLOSED', eventName: 'CompensationPlanClosed' },
        { action: 'Close', from: 'SUSPENDED', to: 'CLOSED', eventName: 'CompensationPlanClosed' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['CLOSED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'CompensationPlan');
  }
}
