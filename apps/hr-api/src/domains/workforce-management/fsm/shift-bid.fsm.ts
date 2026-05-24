import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerShiftBidFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'ShiftBid',
    states: ['SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'],
    actions: ['CreateShiftBid', 'ApproveShiftBid', 'RejectShiftBid', 'CancelShiftBid'],
    transitions: [
      { action: 'CreateShiftBid', from: 'SUBMITTED', to: 'SUBMITTED', eventName: 'ShiftBidSubmitted' },
      { action: 'ApproveShiftBid', from: 'SUBMITTED', to: 'APPROVED', eventName: 'ShiftBidApproved' },
      { action: 'RejectShiftBid', from: 'SUBMITTED', to: 'REJECTED', eventName: 'ShiftBidRejected' },
      { action: 'CancelShiftBid', from: 'SUBMITTED', to: 'CANCELLED', eventName: 'ShiftBidCancelled' },
    ],
    initialState: 'SUBMITTED',
    terminalStates: ['APPROVED', 'REJECTED', 'CANCELLED'],
  };
  fsm.register(definition);
}
