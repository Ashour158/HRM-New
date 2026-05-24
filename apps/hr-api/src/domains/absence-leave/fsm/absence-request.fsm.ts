import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerAbsenceRequestFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'AbsenceRequest',
    states: ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'],
    actions: ['CreateAbsenceRequest', 'SubmitAbsenceRequest', 'ApproveAbsenceRequest', 'RejectAbsenceRequest', 'CancelAbsenceRequest'],
    transitions: [
      { action: 'CreateAbsenceRequest', from: 'DRAFT', to: 'DRAFT', eventName: 'AbsenceRequestCreated' },
      { action: 'SubmitAbsenceRequest', from: 'DRAFT', to: 'PENDING_APPROVAL', eventName: 'AbsenceRequestSubmitted' },
      { action: 'ApproveAbsenceRequest', from: 'PENDING_APPROVAL', to: 'APPROVED', eventName: 'AbsenceRequestApproved' },
      { action: 'RejectAbsenceRequest', from: 'PENDING_APPROVAL', to: 'REJECTED', eventName: 'AbsenceRequestRejected' },
      { action: 'CancelAbsenceRequest', from: 'DRAFT', to: 'CANCELLED', eventName: 'AbsenceRequestCancelled' },
      { action: 'CancelAbsenceRequest', from: 'PENDING_APPROVAL', to: 'CANCELLED', eventName: 'AbsenceRequestCancelled' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['APPROVED', 'REJECTED', 'CANCELLED'],
  };
  fsm.register(definition);
}
