import { Inject, Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for SpendingAccount lifecycle management.
 *
 * States: ACTIVE → SUSPENDED → CLOSED (terminal)
 */
@Injectable()
export class SpendingAccountFsm {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'SpendingAccount',
      states: ['ACTIVE', 'SUSPENDED', 'CLOSED'],
      actions: ['RecordUsage', 'Suspend', 'Reactivate', 'Close'],
      transitions: [
        { action: 'RecordUsage', from: 'ACTIVE', to: 'ACTIVE', eventName: 'SpendingAccountUpdated' },
        { action: 'Suspend', from: 'ACTIVE', to: 'SUSPENDED', eventName: 'SpendingAccountSuspended' },
        { action: 'Reactivate', from: 'SUSPENDED', to: 'ACTIVE', eventName: 'SpendingAccountReactivated' },
        { action: 'Close', from: 'ACTIVE', to: 'CLOSED', eventName: 'SpendingAccountClosed' },
        { action: 'Close', from: 'SUSPENDED', to: 'CLOSED', eventName: 'SpendingAccountClosed' },
      ],
      initialState: 'ACTIVE',
      terminalStates: ['CLOSED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'SpendingAccount');
  }
}
