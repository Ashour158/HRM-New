import { Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for BenefitsProgram lifecycle management.
 *
 * States: DRAFT → ACTIVE → SUSPENDED → CLOSED (terminal)
 */
@Injectable()
export class BenefitsProgramFsm {
  constructor(private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'BenefitsProgram',
      states: ['DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED'],
      actions: ['Activate', 'Suspend', 'Close'],
      transitions: [
        { action: 'Activate', from: 'DRAFT', to: 'ACTIVE', eventName: 'BenefitsProgramActivated' },
        { action: 'Activate', from: 'SUSPENDED', to: 'ACTIVE', eventName: 'BenefitsProgramActivated' },
        { action: 'Suspend', from: 'ACTIVE', to: 'SUSPENDED', eventName: 'BenefitsProgramSuspended' },
        { action: 'Close', from: 'ACTIVE', to: 'CLOSED', eventName: 'BenefitsProgramClosed' },
        { action: 'Close', from: 'SUSPENDED', to: 'CLOSED', eventName: 'BenefitsProgramClosed' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['CLOSED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'BenefitsProgram');
  }
}
