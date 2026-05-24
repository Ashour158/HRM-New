import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerLeaveCaseFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'LeaveCase',
    states: ['OPEN', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'RETURN_TO_WORK', 'CLOSED', 'REJECTED'],
    actions: ['OpenLeaveCase', 'ApproveLeaveCase', 'ActivateLeaveCase', 'PlanReturnToWork', 'CloseLeaveCase', 'RejectLeaveCase'],
    transitions: [
      { action: 'OpenLeaveCase', from: 'OPEN', to: 'OPEN', eventName: 'LeaveCaseOpened' },
      { action: 'ApproveLeaveCase', from: 'OPEN', to: 'APPROVED', eventName: 'LeaveCaseApproved' },
      { action: 'ApproveLeaveCase', from: 'UNDER_REVIEW', to: 'APPROVED', eventName: 'LeaveCaseApproved' },
      { action: 'ActivateLeaveCase', from: 'APPROVED', to: 'ACTIVE', eventName: 'LeaveCaseActive' },
      { action: 'PlanReturnToWork', from: 'ACTIVE', to: 'RETURN_TO_WORK', eventName: 'ReturnToWorkPlanned' },
      { action: 'CloseLeaveCase', from: 'ACTIVE', to: 'CLOSED', eventName: 'LeaveCaseClosed' },
      { action: 'CloseLeaveCase', from: 'RETURN_TO_WORK', to: 'CLOSED', eventName: 'LeaveCaseClosed' },
      { action: 'RejectLeaveCase', from: 'OPEN', to: 'REJECTED', eventName: 'LeaveCaseRejected' },
      { action: 'RejectLeaveCase', from: 'UNDER_REVIEW', to: 'REJECTED', eventName: 'LeaveCaseRejected' },
    ],
    initialState: 'OPEN',
    terminalStates: ['CLOSED', 'REJECTED'],
  };
  fsm.register(definition);
}
