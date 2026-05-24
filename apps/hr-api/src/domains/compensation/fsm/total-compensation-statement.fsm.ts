import { Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for TotalCompensationStatement lifecycle management.
 *
 * States: DRAFT → GENERATED → DELIVERED → ACKNOWLEDGED (terminal)
 */
@Injectable()
export class TotalCompensationStatementFsm {
  constructor(private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'TotalCompensationStatement',
      states: ['DRAFT', 'GENERATED', 'DELIVERED', 'ACKNOWLEDGED'],
      actions: ['Generate', 'Deliver', 'Acknowledge'],
      transitions: [
        { action: 'Generate', from: 'DRAFT', to: 'GENERATED', eventName: 'TotalCompStatementGenerated' },
        { action: 'Deliver', from: 'GENERATED', to: 'DELIVERED', eventName: 'TotalCompStatementDelivered' },
        { action: 'Acknowledge', from: 'DELIVERED', to: 'ACKNOWLEDGED', eventName: 'TotalCompStatementAcknowledged' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['ACKNOWLEDGED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'TotalCompensationStatement');
  }
}
