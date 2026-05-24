import { Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for CompensationBand lifecycle management.
 *
 * States: DRAFT → ACTIVE → REVISED → CLOSED (terminal)
 */
@Injectable()
export class CompensationBandFsm {
  constructor(private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'CompensationBand',
      states: ['DRAFT', 'ACTIVE', 'REVISED', 'CLOSED'],
      actions: ['Activate', 'Revise', 'Close'],
      transitions: [
        { action: 'Activate', from: 'DRAFT', to: 'ACTIVE', eventName: 'CompensationBandActivated' },
        { action: 'Revise', from: 'ACTIVE', to: 'REVISED', eventName: 'CompensationBandRevised' },
        { action: 'Revise', from: 'REVISED', to: 'REVISED', eventName: 'CompensationBandRevised' },
        { action: 'Close', from: 'ACTIVE', to: 'CLOSED', eventName: 'CompensationBandClosed' },
        { action: 'Close', from: 'REVISED', to: 'CLOSED', eventName: 'CompensationBandClosed' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['CLOSED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'CompensationBand');
  }
}
