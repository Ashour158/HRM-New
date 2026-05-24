import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerSurveyResponseFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'SurveyResponse',
    states: ['STARTED', 'COMPLETED', 'SUBMITTED'],
    actions: ['CreateSurveyResponse', 'CompleteSurveyResponse', 'SubmitSurveyResponse'],
    transitions: [
      { action: 'CreateSurveyResponse', from: 'STARTED', to: 'STARTED', eventName: 'SurveyResponseStarted' },
      { action: 'CompleteSurveyResponse', from: 'STARTED', to: 'COMPLETED', eventName: 'SurveyResponseCompleted' },
      { action: 'SubmitSurveyResponse', from: 'COMPLETED', to: 'SUBMITTED', eventName: 'SurveyResponseSubmitted' },
    ],
    initialState: 'STARTED',
    terminalStates: ['SUBMITTED'],
  };
  fsm.register(definition);
}
