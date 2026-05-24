import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerShiftSwapRequestFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'ShiftSwapRequest',
    states: ['REQUESTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'],
    actions: ['CreateShiftSwapRequest', 'ApproveShiftSwapRequest', 'RejectShiftSwapRequest', 'CancelShiftSwapRequest'],
    transitions: [
      { action: 'CreateShiftSwapRequest', from: 'REQUESTED', to: 'REQUESTED', eventName: 'ShiftSwapRequested' },
      { action: 'ApproveShiftSwapRequest', from: 'REQUESTED', to: 'APPROVED', eventName: 'ShiftSwapApproved' },
      { action: 'ApproveShiftSwapRequest', from: 'PENDING_APPROVAL', to: 'APPROVED', eventName: 'ShiftSwapApproved' },
      { action: 'RejectShiftSwapRequest', from: 'REQUESTED', to: 'REJECTED', eventName: 'ShiftSwapRejected' },
      { action: 'RejectShiftSwapRequest', from: 'PENDING_APPROVAL', to: 'REJECTED', eventName: 'ShiftSwapRejected' },
      { action: 'CancelShiftSwapRequest', from: 'REQUESTED', to: 'CANCELLED', eventName: 'ShiftSwapCancelled' },
      { action: 'CancelShiftSwapRequest', from: 'PENDING_APPROVAL', to: 'CANCELLED', eventName: 'ShiftSwapCancelled' },
    ],
    initialState: 'REQUESTED',
    terminalStates: ['APPROVED', 'REJECTED', 'CANCELLED'],
  };
  fsm.register(definition);
}
