import { Inject, Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for PayScale lifecycle management.
 *
 * States: DRAFT → ACTIVE → REVISED → CLOSED (terminal)
 */
@Injectable()
export class PayScaleFsm {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'PayScale',
      states: ['DRAFT', 'ACTIVE', 'REVISED', 'CLOSED'],
      actions: ['Activate', 'Revise', 'Close'],
      transitions: [
        { action: 'Activate', from: 'DRAFT', to: 'ACTIVE', eventName: 'PayScaleActivated' },
        { action: 'Revise', from: 'ACTIVE', to: 'REVISED', eventName: 'PayScaleRevised' },
        { action: 'Revise', from: 'REVISED', to: 'REVISED', eventName: 'PayScaleRevised' },
        { action: 'Close', from: 'ACTIVE', to: 'CLOSED', eventName: 'PayScaleClosed' },
        { action: 'Close', from: 'REVISED', to: 'CLOSED', eventName: 'PayScaleClosed' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['CLOSED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'PayScale');
  }
}
