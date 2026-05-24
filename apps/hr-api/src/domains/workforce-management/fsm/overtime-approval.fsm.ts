import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerWfmOvertimeApprovalFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'WfmOvertimeApproval',
    states: ['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'],
    actions: ['RequestWfmOvertime', 'ApproveWfmOvertime', 'RejectWfmOvertime', 'CancelWfmOvertime'],
    transitions: [
      { action: 'RequestWfmOvertime', from: 'REQUESTED', to: 'REQUESTED', eventName: 'WfmOvertimeRequested' },
      { action: 'ApproveWfmOvertime', from: 'REQUESTED', to: 'APPROVED', eventName: 'WfmOvertimeApproved' },
      { action: 'RejectWfmOvertime', from: 'REQUESTED', to: 'REJECTED', eventName: 'WfmOvertimeRejected' },
      { action: 'CancelWfmOvertime', from: 'REQUESTED', to: 'CANCELLED', eventName: 'WfmOvertimeCancelled' },
    ],
    initialState: 'REQUESTED',
    terminalStates: ['APPROVED', 'REJECTED', 'CANCELLED'],
  };
  fsm.register(definition);
}
