import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerTimeClockEventFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'TimeClockEvent',
    states: ['RECORDED', 'VALIDATED', 'EXCEPTION', 'RESOLVED'],
    actions: ['RecordTimeClockEvent', 'ValidateTimeClockEvent', 'MarkTimeClockException', 'ResolveTimeClockEvent'],
    transitions: [
      { action: 'RecordTimeClockEvent', from: 'RECORDED', to: 'RECORDED', eventName: 'TimeClockEventRecorded' },
      { action: 'ValidateTimeClockEvent', from: 'RECORDED', to: 'VALIDATED', eventName: 'TimeClockEventValidated' },
      { action: 'MarkTimeClockException', from: 'RECORDED', to: 'EXCEPTION', eventName: 'AttendanceExceptionCreated' },
      { action: 'MarkTimeClockException', from: 'VALIDATED', to: 'EXCEPTION', eventName: 'AttendanceExceptionCreated' },
      { action: 'ResolveTimeClockEvent', from: 'EXCEPTION', to: 'RESOLVED', eventName: 'AttendanceExceptionResolved' },
    ],
    initialState: 'RECORDED',
    terminalStates: ['RESOLVED'],
  };
  fsm.register(definition);
}
