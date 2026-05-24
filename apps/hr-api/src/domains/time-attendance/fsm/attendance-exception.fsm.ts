import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerAttendanceExceptionFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'AttendanceException',
    states: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED'],
    actions: ['CreateAttendanceException', 'ReviewAttendanceException', 'ResolveAttendanceException', 'EscalateAttendanceException'],
    transitions: [
      { action: 'CreateAttendanceException', from: 'OPEN', to: 'OPEN', eventName: 'AttendanceExceptionCreated' },
      { action: 'ReviewAttendanceException', from: 'OPEN', to: 'UNDER_REVIEW', eventName: 'AttendanceExceptionReviewed' },
      { action: 'ResolveAttendanceException', from: 'OPEN', to: 'RESOLVED', eventName: 'AttendanceExceptionResolved' },
      { action: 'ResolveAttendanceException', from: 'UNDER_REVIEW', to: 'RESOLVED', eventName: 'AttendanceExceptionResolved' },
      { action: 'EscalateAttendanceException', from: 'OPEN', to: 'ESCALATED', eventName: 'AttendanceExceptionEscalated' },
      { action: 'EscalateAttendanceException', from: 'UNDER_REVIEW', to: 'ESCALATED', eventName: 'AttendanceExceptionEscalated' },
    ],
    initialState: 'OPEN',
    terminalStates: ['RESOLVED', 'ESCALATED'],
  };
  fsm.register(definition);
}
