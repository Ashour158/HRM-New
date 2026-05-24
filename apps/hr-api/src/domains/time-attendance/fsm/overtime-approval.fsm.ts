import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerOvertimeApprovalFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'OvertimeApproval',
    states: ['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'],
    actions: ['RequestOvertime', 'ApproveOvertime', 'RejectOvertime', 'CancelOvertime'],
    transitions: [
      { action: 'RequestOvertime', from: 'REQUESTED', to: 'REQUESTED', eventName: 'OvertimeRequested' },
      { action: 'ApproveOvertime', from: 'REQUESTED', to: 'APPROVED', eventName: 'OvertimeApproved' },
      { action: 'RejectOvertime', from: 'REQUESTED', to: 'REJECTED', eventName: 'OvertimeRejected' },
      { action: 'CancelOvertime', from: 'REQUESTED', to: 'CANCELLED', eventName: 'OvertimeCancelled' },
    ],
    initialState: 'REQUESTED',
    terminalStates: ['APPROVED', 'REJECTED', 'CANCELLED'],
  };
  fsm.register(definition);
}
