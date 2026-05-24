import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerSuccessionPlanFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'SuccessionPlan',
    states: ['DRAFT', 'ACTIVE', 'REVIEWED', 'EXECUTED', 'CLOSED'],
    actions: ['CreateSuccessionPlan', 'ActivateSuccessionPlan', 'ReviewSuccessionPlan', 'ExecuteSuccessionPlan', 'CloseSuccessionPlan'],
    transitions: [
      { action: 'CreateSuccessionPlan', from: 'DRAFT', to: 'DRAFT', eventName: 'SuccessionPlanCreated' },
      { action: 'ActivateSuccessionPlan', from: 'DRAFT', to: 'ACTIVE', eventName: 'SuccessionPlanActivated' },
      { action: 'ReviewSuccessionPlan', from: 'ACTIVE', to: 'REVIEWED', eventName: 'SuccessionPlanReviewed' },
      { action: 'ExecuteSuccessionPlan', from: 'REVIEWED', to: 'EXECUTED', eventName: 'SuccessionPlanExecuted' },
      { action: 'CloseSuccessionPlan', from: 'DRAFT', to: 'CLOSED', eventName: 'SuccessionPlanClosed' },
      { action: 'CloseSuccessionPlan', from: 'ACTIVE', to: 'CLOSED', eventName: 'SuccessionPlanClosed' },
      { action: 'CloseSuccessionPlan', from: 'REVIEWED', to: 'CLOSED', eventName: 'SuccessionPlanClosed' },
      { action: 'CloseSuccessionPlan', from: 'EXECUTED', to: 'CLOSED', eventName: 'SuccessionPlanClosed' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['CLOSED'],
  };
  fsm.register(definition);
}
