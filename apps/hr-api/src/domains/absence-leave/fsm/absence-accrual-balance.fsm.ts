import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerAbsenceAccrualBalanceFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'AbsenceAccrualBalance',
    states: ['ACTIVE', 'SUSPENDED', 'CLOSED'],
    actions: ['CreateAbsenceAccrualBalance', 'UpdateAbsenceAccrualBalance', 'CarryOverAbsenceAccrualBalance', 'CloseAbsenceAccrualBalance'],
    transitions: [
      { action: 'CreateAbsenceAccrualBalance', from: 'ACTIVE', to: 'ACTIVE', eventName: 'AccrualBalanceCreated' },
      { action: 'UpdateAbsenceAccrualBalance', from: 'ACTIVE', to: 'ACTIVE', eventName: 'AccrualBalanceUpdated' },
      { action: 'CarryOverAbsenceAccrualBalance', from: 'ACTIVE', to: 'ACTIVE', eventName: 'AccrualBalanceCarriedOver' },
      { action: 'CloseAbsenceAccrualBalance', from: 'ACTIVE', to: 'CLOSED', eventName: 'AccrualBalanceClosed' },
    ],
    initialState: 'ACTIVE',
    terminalStates: ['CLOSED'],
  };
  fsm.register(definition);
}
