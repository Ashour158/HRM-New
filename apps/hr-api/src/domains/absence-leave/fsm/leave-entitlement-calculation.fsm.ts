import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerLeaveEntitlementCalculationFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'LeaveEntitlementCalculation',
    states: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
    actions: ['StartLeaveEntitlementCalculation', 'CompleteLeaveEntitlementCalculation', 'FailLeaveEntitlementCalculation'],
    transitions: [
      { action: 'StartLeaveEntitlementCalculation', from: 'PENDING', to: 'PENDING', eventName: 'LeaveEntitlementCalculationStarted' },
      { action: 'CompleteLeaveEntitlementCalculation', from: 'PENDING', to: 'COMPLETED', eventName: 'LeaveEntitlementCalculated' },
      { action: 'CompleteLeaveEntitlementCalculation', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'LeaveEntitlementCalculated' },
      { action: 'FailLeaveEntitlementCalculation', from: 'PENDING', to: 'FAILED', eventName: 'LeaveEntitlementCalculationFailed' },
      { action: 'FailLeaveEntitlementCalculation', from: 'IN_PROGRESS', to: 'FAILED', eventName: 'LeaveEntitlementCalculationFailed' },
    ],
    initialState: 'PENDING',
    terminalStates: ['COMPLETED', 'FAILED'],
  };
  fsm.register(definition);
}
