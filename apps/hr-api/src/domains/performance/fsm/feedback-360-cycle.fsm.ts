import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerFeedback360CycleFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'PerformanceFeedback360Cycle',
    states: ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED', 'CANCELLED'],
    actions: ['CreatePerformanceFeedback360Cycle', 'ActivatePerformanceFeedback360Cycle', 'LaunchPerformanceFeedback360Cycle', 'ClosePerformanceFeedback360Cycle', 'ArchivePerformanceFeedback360Cycle'],
    transitions: [
      { action: 'CreatePerformanceFeedback360Cycle', from: 'DRAFT', to: 'DRAFT', eventName: 'Feedback360CycleCreated' },
      { action: 'ActivatePerformanceFeedback360Cycle', from: 'DRAFT', to: 'ACTIVE', eventName: 'Feedback360CycleActivated' },
      { action: 'LaunchPerformanceFeedback360Cycle', from: 'ACTIVE', to: 'IN_PROGRESS', eventName: 'Feedback360CycleLaunched' },
      { action: 'ClosePerformanceFeedback360Cycle', from: 'IN_PROGRESS', to: 'CLOSED', eventName: 'Feedback360CycleClosed' },
      { action: 'ArchivePerformanceFeedback360Cycle', from: 'CLOSED', to: 'ARCHIVED', eventName: 'Feedback360CycleArchived' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ARCHIVED', 'CANCELLED'],
  };
  fsm.register(definition);
}
