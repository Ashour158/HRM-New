import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerGoalFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'Goal',
    states: ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'ACHIEVED', 'MISSED', 'CANCELLED'],
    actions: ['CreateGoal', 'ActivateGoal', 'UpdateGoalProgress', 'MarkGoalAchieved', 'MarkGoalMissed', 'CancelGoal'],
    transitions: [
      { action: 'CreateGoal', from: 'DRAFT', to: 'DRAFT', eventName: 'GoalCreated' },
      { action: 'ActivateGoal', from: 'DRAFT', to: 'ACTIVE', eventName: 'GoalActivated' },
      { action: 'UpdateGoalProgress', from: 'ACTIVE', to: 'IN_PROGRESS', eventName: 'GoalProgressUpdated' },
      { action: 'UpdateGoalProgress', from: 'IN_PROGRESS', to: 'IN_PROGRESS', eventName: 'GoalProgressUpdated' },
      { action: 'UpdateGoalProgress', from: 'ACTIVE', to: 'ACHIEVED', eventName: 'GoalAchieved' },
      { action: 'UpdateGoalProgress', from: 'IN_PROGRESS', to: 'ACHIEVED', eventName: 'GoalAchieved' },
      { action: 'MarkGoalAchieved', from: 'ACTIVE', to: 'ACHIEVED', eventName: 'GoalAchieved' },
      { action: 'MarkGoalAchieved', from: 'IN_PROGRESS', to: 'ACHIEVED', eventName: 'GoalAchieved' },
      { action: 'MarkGoalMissed', from: 'ACTIVE', to: 'MISSED', eventName: 'GoalMissed' },
      { action: 'MarkGoalMissed', from: 'IN_PROGRESS', to: 'MISSED', eventName: 'GoalMissed' },
      { action: 'CancelGoal', from: 'DRAFT', to: 'CANCELLED', eventName: 'GoalCancelled' },
      { action: 'CancelGoal', from: 'ACTIVE', to: 'CANCELLED', eventName: 'GoalCancelled' },
      { action: 'CancelGoal', from: 'IN_PROGRESS', to: 'CANCELLED', eventName: 'GoalCancelled' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ACHIEVED', 'MISSED', 'CANCELLED'],
  };
  fsm.register(definition);
}
