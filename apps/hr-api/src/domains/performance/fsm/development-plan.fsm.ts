import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerDevelopmentPlanFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'DevelopmentPlan',
    states: ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'],
    actions: ['CreateDevelopmentPlan', 'ActivateDevelopmentPlan', 'RecordDevelopmentMilestone', 'CompleteDevelopmentPlan', 'CloseDevelopmentPlan'],
    transitions: [
      { action: 'CreateDevelopmentPlan', from: 'DRAFT', to: 'DRAFT', eventName: 'DevelopmentPlanCreated' },
      { action: 'ActivateDevelopmentPlan', from: 'DRAFT', to: 'ACTIVE', eventName: 'DevelopmentPlanActivated' },
      { action: 'RecordDevelopmentMilestone', from: 'ACTIVE', to: 'IN_PROGRESS', eventName: 'DevelopmentPlanMilestoneRecorded' },
      { action: 'RecordDevelopmentMilestone', from: 'IN_PROGRESS', to: 'IN_PROGRESS', eventName: 'DevelopmentPlanMilestoneRecorded' },
      { action: 'CompleteDevelopmentPlan', from: 'ACTIVE', to: 'COMPLETED', eventName: 'DevelopmentPlanCompleted' },
      { action: 'CompleteDevelopmentPlan', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'DevelopmentPlanCompleted' },
      { action: 'CloseDevelopmentPlan', from: 'COMPLETED', to: 'CLOSED', eventName: 'DevelopmentPlanClosed' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['CLOSED', 'CANCELLED'],
  };
  fsm.register(definition);
}
