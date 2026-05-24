import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerHrServiceCaseFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'HrServiceCase',
    states: ['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'RESOLVED', 'CLOSED', 'ESCALATED'],
    actions: ['OpenHrServiceCase', 'MarkInProgressHrServiceCase', 'MarkPendingCustomerHrServiceCase', 'ResolveHrServiceCase', 'CloseHrServiceCase'],
    transitions: [
      { action: 'OpenHrServiceCase', from: 'OPEN', to: 'OPEN', eventName: 'HrServiceCaseOpened' },
      { action: 'MarkInProgressHrServiceCase', from: 'OPEN', to: 'IN_PROGRESS', eventName: 'HrServiceCaseInProgress' },
      { action: 'MarkPendingCustomerHrServiceCase', from: 'IN_PROGRESS', to: 'PENDING_CUSTOMER', eventName: 'HrServiceCasePendingCustomer' },
      { action: 'ResolveHrServiceCase', from: 'IN_PROGRESS', to: 'RESOLVED', eventName: 'HrServiceCaseResolved' },
      { action: 'ResolveHrServiceCase', from: 'PENDING_CUSTOMER', to: 'RESOLVED', eventName: 'HrServiceCaseResolved' },
      { action: 'CloseHrServiceCase', from: 'RESOLVED', to: 'CLOSED', eventName: 'HrServiceCaseClosed' },
    ],
    initialState: 'OPEN',
    terminalStates: ['CLOSED', 'ESCALATED'],
  };
  fsm.register(definition);
}
