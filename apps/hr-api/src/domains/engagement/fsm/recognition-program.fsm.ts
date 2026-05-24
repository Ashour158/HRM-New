import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerRecognitionProgramFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'RecognitionProgram',
    states: ['ACTIVE', 'SUSPENDED', 'CLOSED'],
    actions: ['CreateRecognitionProgram', 'ActivateRecognitionProgram', 'SuspendRecognitionProgram', 'CloseRecognitionProgram'],
    transitions: [
      { action: 'CreateRecognitionProgram', from: 'ACTIVE', to: 'ACTIVE', eventName: 'RecognitionProgramCreated' },
      { action: 'ActivateRecognitionProgram', from: 'SUSPENDED', to: 'ACTIVE', eventName: 'RecognitionProgramActivated' },
      { action: 'SuspendRecognitionProgram', from: 'ACTIVE', to: 'SUSPENDED', eventName: 'RecognitionProgramSuspended' },
      { action: 'CloseRecognitionProgram', from: 'ACTIVE', to: 'CLOSED', eventName: 'RecognitionProgramClosed' },
      { action: 'CloseRecognitionProgram', from: 'SUSPENDED', to: 'CLOSED', eventName: 'RecognitionProgramClosed' },
    ],
    initialState: 'ACTIVE',
    terminalStates: ['CLOSED'],
  };
  fsm.register(definition);
}
