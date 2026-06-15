import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerFeedback360CycleFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'Feedback360Cycle',
    states: ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'],
    actions: ['CreateFeedback360Cycle', 'ActivateFeedback360Cycle', 'StartFeedback360Cycle', 'SubmitFeedback360Response', 'CompleteFeedback360Cycle'],
    transitions: [
      { action: 'CreateFeedback360Cycle', from: 'DRAFT', to: 'DRAFT', eventName: 'Feedback360CycleCreated' },
      { action: 'ActivateFeedback360Cycle', from: 'DRAFT', to: 'ACTIVE', eventName: 'Feedback360CycleActivated' },
      { action: 'StartFeedback360Cycle', from: 'ACTIVE', to: 'IN_PROGRESS', eventName: 'Feedback360CycleStarted' },
      { action: 'SubmitFeedback360Response', from: 'IN_PROGRESS', to: 'IN_PROGRESS', eventName: 'Feedback360ResponseSubmitted' },
      { action: 'CompleteFeedback360Cycle', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'Feedback360CycleCompleted' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['COMPLETED', 'CLOSED'],
  };
  fsm.register(definition);
}
