import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerSowEngagementFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'SowEngagement',
    states: ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'],
    actions: ['CreateSowEngagement', 'ActivateSowEngagement', 'StartSowEngagement', 'CompleteSowEngagement', 'CloseSowEngagement'],
    transitions: [
      { action: 'CreateSowEngagement', from: 'DRAFT', to: 'DRAFT', eventName: 'SowEngagementCreated' },
      { action: 'ActivateSowEngagement', from: 'DRAFT', to: 'ACTIVE', eventName: 'SowEngagementActivated' },
      { action: 'StartSowEngagement', from: 'ACTIVE', to: 'IN_PROGRESS', eventName: 'SowEngagementStarted' },
      { action: 'CompleteSowEngagement', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'SowEngagementCompleted' },
      { action: 'CloseSowEngagement', from: 'COMPLETED', to: 'CLOSED', eventName: 'SowEngagementClosed' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['CLOSED', 'CANCELLED'],
  };
  fsm.register(definition);
}
