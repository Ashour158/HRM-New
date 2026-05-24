import { Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for LegalEntity lifecycle management.
 *
 * States: DRAFT → ACTIVE → INACTIVE → DISSOLVED (terminal)
 */
@Injectable()
export class LegalEntityFsm {
  constructor(private readonly fsmFramework: FsmFramework) {}

  /**
   * Registers the LegalEntity FSM definition with the framework.
   */
  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'LegalEntity',
      states: ['DRAFT', 'ACTIVE', 'INACTIVE', 'DISSOLVED'],
      actions: ['Activate', 'Deactivate', 'Reactivate', 'Dissolve'],
      transitions: [
        { action: 'Activate', from: 'DRAFT', to: 'ACTIVE', eventName: 'LegalEntityActivated' },
        { action: 'Deactivate', from: 'ACTIVE', to: 'INACTIVE', eventName: 'LegalEntityDeactivated' },
        { action: 'Reactivate', from: 'INACTIVE', to: 'ACTIVE', eventName: 'LegalEntityActivated' },
        { action: 'Dissolve', from: 'ACTIVE', to: 'DISSOLVED', eventName: 'LegalEntityDissolved' },
        { action: 'Dissolve', from: 'INACTIVE', to: 'DISSOLVED', eventName: 'LegalEntityDissolved' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['DISSOLVED'],
    };
    this.fsmFramework.register(definition);
  }

  /**
   * Returns the list of actions allowed from the given state.
   */
  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'LegalEntity');
  }
}
