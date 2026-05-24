import { Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for OrgUnit lifecycle management.
 *
 * States: DRAFT → ACTIVE → INACTIVE → DISSOLVED (terminal)
 */
@Injectable()
export class OrgUnitFsm {
  constructor(private readonly fsmFramework: FsmFramework) {}

  /**
   * Registers the OrgUnit FSM definition with the framework.
   */
  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'OrgUnit',
      states: ['DRAFT', 'ACTIVE', 'INACTIVE', 'DISSOLVED'],
      actions: ['Activate', 'Deactivate', 'Reactivate', 'Dissolve', 'Restructure'],
      transitions: [
        { action: 'Activate', from: 'DRAFT', to: 'ACTIVE', eventName: 'OrgUnitActivated' },
        { action: 'Deactivate', from: 'ACTIVE', to: 'INACTIVE', eventName: 'OrgUnitDeactivated' },
        { action: 'Reactivate', from: 'INACTIVE', to: 'ACTIVE', eventName: 'OrgUnitActivated' },
        { action: 'Dissolve', from: 'ACTIVE', to: 'DISSOLVED', eventName: 'OrgUnitDissolved' },
        { action: 'Dissolve', from: 'INACTIVE', to: 'DISSOLVED', eventName: 'OrgUnitDissolved' },
        { action: 'Restructure', from: 'ACTIVE', to: 'ACTIVE', eventName: 'OrgUnitRestructured' },
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
    return this.fsmFramework.getAllowedActionsFromState(state, 'OrgUnit');
  }
}
