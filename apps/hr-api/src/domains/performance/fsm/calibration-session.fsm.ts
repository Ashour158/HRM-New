import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerCalibrationSessionFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'CalibrationSession',
    states: ['DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FINALIZED', 'CANCELLED'],
    actions: ['CreateCalibrationSession', 'ScheduleCalibrationSession', 'StartCalibrationSession', 'CompleteCalibrationSession', 'FinalizeCalibrationSession'],
    transitions: [
      { action: 'CreateCalibrationSession', from: 'DRAFT', to: 'DRAFT', eventName: 'CalibrationSessionCreated' },
      { action: 'ScheduleCalibrationSession', from: 'DRAFT', to: 'SCHEDULED', eventName: 'CalibrationSessionScheduled' },
      { action: 'StartCalibrationSession', from: 'SCHEDULED', to: 'IN_PROGRESS', eventName: 'CalibrationSessionStarted' },
      { action: 'CompleteCalibrationSession', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'CalibrationSessionCompleted' },
      { action: 'FinalizeCalibrationSession', from: 'COMPLETED', to: 'FINALIZED', eventName: 'CalibrationSessionFinalized' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['FINALIZED', 'CANCELLED'],
  };
  fsm.register(definition);
}
