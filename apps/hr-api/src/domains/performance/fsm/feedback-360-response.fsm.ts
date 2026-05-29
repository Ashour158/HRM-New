import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerFeedback360ResponseFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'PerformanceFeedback360Response',
    states: ['PENDING', 'SUBMITTED', 'EXPIRED', 'WITHDRAWN'],
    actions: ['CreateFeedback360Response', 'SubmitFeedback360Response', 'ExpireFeedback360Response', 'WithdrawFeedback360Response'],
    transitions: [
      { action: 'CreateFeedback360Response', from: 'PENDING', to: 'PENDING', eventName: 'Feedback360ResponseCreated' },
      { action: 'SubmitFeedback360Response', from: 'PENDING', to: 'SUBMITTED', eventName: 'Feedback360ResponseSubmitted' },
      { action: 'ExpireFeedback360Response', from: 'PENDING', to: 'EXPIRED', eventName: 'Feedback360ResponseExpired' },
      { action: 'WithdrawFeedback360Response', from: 'PENDING', to: 'WITHDRAWN', eventName: 'Feedback360ResponseWithdrawn' },
    ],
    initialState: 'PENDING',
    terminalStates: ['SUBMITTED', 'EXPIRED', 'WITHDRAWN'],
  };
  fsm.register(definition);
}
