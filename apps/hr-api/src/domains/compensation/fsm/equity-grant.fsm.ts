import { Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for EquityGrant lifecycle management.
 *
 * States: GRANTED → VESTING → VESTED → EXERCISED → EXPIRED (terminal)
 *                                        ↘ FORFEITED (terminal)
 */
@Injectable()
export class EquityGrantFsm {
  constructor(private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'EquityGrant',
      states: ['GRANTED', 'VESTING', 'VESTED', 'EXERCISED', 'EXPIRED', 'FORFEITED'],
      actions: ['StartVesting', 'RecordVesting', 'Exercise', 'Expire', 'Forfeit'],
      transitions: [
        { action: 'StartVesting', from: 'GRANTED', to: 'VESTING', eventName: 'EquityGrantVestingStarted' },
        { action: 'RecordVesting', from: 'VESTING', to: 'VESTING', eventName: 'EquityGrantVested' },
        { action: 'RecordVesting', from: 'VESTING', to: 'VESTED', eventName: 'EquityGrantVested' },
        { action: 'RecordVesting', from: 'VESTED', to: 'VESTED', eventName: 'EquityGrantVested' },
        { action: 'Exercise', from: 'VESTED', to: 'EXERCISED', eventName: 'EquityGrantExercised' },
        { action: 'Exercise', from: 'EXERCISED', to: 'EXERCISED', eventName: 'EquityGrantExercised' },
        { action: 'Expire', from: 'GRANTED', to: 'EXPIRED', eventName: 'EquityGrantExpired' },
        { action: 'Expire', from: 'VESTING', to: 'EXPIRED', eventName: 'EquityGrantExpired' },
        { action: 'Expire', from: 'VESTED', to: 'EXPIRED', eventName: 'EquityGrantExpired' },
        { action: 'Expire', from: 'EXERCISED', to: 'EXPIRED', eventName: 'EquityGrantExpired' },
        { action: 'Forfeit', from: 'GRANTED', to: 'FORFEITED', eventName: 'EquityGrantForfeited' },
        { action: 'Forfeit', from: 'VESTING', to: 'FORFEITED', eventName: 'EquityGrantForfeited' },
        { action: 'Forfeit', from: 'VESTED', to: 'FORFEITED', eventName: 'EquityGrantForfeited' },
      ],
      initialState: 'GRANTED',
      terminalStates: ['EXPIRED', 'FORFEITED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'EquityGrant');
  }
}
