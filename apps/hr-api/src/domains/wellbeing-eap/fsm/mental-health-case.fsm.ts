import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerMentalHealthCaseFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'MentalHealthCase',
    states: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    actions: ['CreateMentalHealthCase', 'AssignToMentalHealthCase', 'StartMentalHealthCase', 'ResolveMentalHealthCase', 'CloseMentalHealthCase'],
    transitions: [
      { action: 'CreateMentalHealthCase', from: '', to: 'OPEN', eventName: 'MentalHealthCaseOpened' },
      { action: 'AssignToMentalHealthCase', from: 'OPEN', to: 'ASSIGNED', eventName: 'MentalHealthCaseAssigned' },
      { action: 'StartMentalHealthCase', from: 'ASSIGNED', to: 'IN_PROGRESS', eventName: 'MentalHealthCaseInProgress' },
      { action: 'ResolveMentalHealthCase', from: 'IN_PROGRESS', to: 'RESOLVED', eventName: 'MentalHealthCaseResolved' },
      { action: 'CloseMentalHealthCase', from: 'RESOLVED', to: 'CLOSED', eventName: 'MentalHealthCaseClosed' },
    ],
    initialState: 'OPEN',
    terminalStates: ['CLOSED'],
  };
  fsm.register(definition);
}
