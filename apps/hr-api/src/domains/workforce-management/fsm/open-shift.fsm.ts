import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerOpenShiftFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'OpenShift',
    states: ['OPEN', 'BID_PENDING', 'FILLED', 'CLOSED', 'CANCELLED'],
    actions: ['CreateOpenShift', 'MarkBidPendingOpenShift', 'FillOpenShift', 'CloseOpenShift', 'CancelOpenShift'],
    transitions: [
      { action: 'CreateOpenShift', from: 'OPEN', to: 'OPEN', eventName: 'OpenShiftCreated' },
      { action: 'MarkBidPendingOpenShift', from: 'OPEN', to: 'BID_PENDING', eventName: 'OpenShiftBidPending' },
      { action: 'FillOpenShift', from: 'OPEN', to: 'FILLED', eventName: 'OpenShiftFilled' },
      { action: 'FillOpenShift', from: 'BID_PENDING', to: 'FILLED', eventName: 'OpenShiftFilled' },
      { action: 'CloseOpenShift', from: 'OPEN', to: 'CLOSED', eventName: 'OpenShiftClosed' },
      { action: 'CloseOpenShift', from: 'BID_PENDING', to: 'CLOSED', eventName: 'OpenShiftClosed' },
      { action: 'CloseOpenShift', from: 'FILLED', to: 'CLOSED', eventName: 'OpenShiftClosed' },
      { action: 'CancelOpenShift', from: 'OPEN', to: 'CANCELLED', eventName: 'OpenShiftCancelled' },
      { action: 'CancelOpenShift', from: 'BID_PENDING', to: 'CANCELLED', eventName: 'OpenShiftCancelled' },
    ],
    initialState: 'OPEN',
    terminalStates: ['CLOSED', 'CANCELLED'],
  };
  fsm.register(definition);
}
