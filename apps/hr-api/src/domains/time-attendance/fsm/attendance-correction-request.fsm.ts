import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

export function registerAttendanceCorrectionRequestFsm(fsm: FsmFramework): void {
  fsm.register({
    aggregateType: 'AttendanceCorrectionRequest',
    states: ['PENDING_MANAGER_REVIEW', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED'],
    actions: ['CreateAttendanceCorrectionRequest', 'ReviewAttendanceCorrectionRequest', 'ApplyAttendanceCorrectionRequest'],
    initialState: 'PENDING_MANAGER_REVIEW',
    terminalStates: ['REJECTED', 'APPLIED', 'CANCELLED'],
    transitions: [
      { action: 'CreateAttendanceCorrectionRequest', from: 'PENDING_MANAGER_REVIEW', to: 'PENDING_MANAGER_REVIEW', eventName: 'AttendanceCorrectionRequestCreated' },
      { action: 'ReviewAttendanceCorrectionRequest', from: 'PENDING_MANAGER_REVIEW', to: 'APPROVED', eventName: 'AttendanceCorrectionRequestReviewed' },
      { action: 'ApplyAttendanceCorrectionRequest', from: 'APPROVED', to: 'APPLIED', eventName: 'AttendanceCorrectionRequestApplied' },
    ],
  });
}
