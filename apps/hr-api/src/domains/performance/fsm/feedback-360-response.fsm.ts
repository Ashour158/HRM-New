import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerFeedback360ResponseFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'PerformanceFeedback360Response',
    states: ['PENDING', 'SUBMITTED', 'EXPIRED', 'WITHDRAWN'],
    actions: [
      'CreatePerformanceFeedback360Response',
      'SubmitPerformanceFeedback360Response',
      'ExpirePerformanceFeedback360Response',
      'WithdrawPerformanceFeedback360Response',
    ],
    transitions: [
      { action: 'CreatePerformanceFeedback360Response', from: 'PENDING', to: 'PENDING', eventName: 'Feedback360ResponseCreated' },
      { action: 'SubmitPerformanceFeedback360Response', from: 'PENDING', to: 'SUBMITTED', eventName: 'Feedback360ResponseSubmitted' },
      { action: 'ExpirePerformanceFeedback360Response', from: 'PENDING', to: 'EXPIRED', eventName: 'Feedback360ResponseExpired' },
      { action: 'WithdrawPerformanceFeedback360Response', from: 'PENDING', to: 'WITHDRAWN', eventName: 'Feedback360ResponseWithdrawn' },
    ],
    initialState: 'PENDING',
    terminalStates: ['SUBMITTED', 'EXPIRED', 'WITHDRAWN'],
  };
  fsm.register(definition);
}
