import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerObjectiveFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'Objective',
    states: ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'ACHIEVED', 'PARTIAL', 'MISSED', 'CANCELLED'],
    actions: ['CreateObjective', 'ActivateObjective', 'UpdateObjectiveProgress', 'MarkObjectiveAchieved', 'CancelObjective'],
    transitions: [
      { action: 'CreateObjective', from: 'DRAFT', to: 'DRAFT', eventName: 'ObjectiveCreated' },
      { action: 'ActivateObjective', from: 'DRAFT', to: 'ACTIVE', eventName: 'ObjectiveActivated' },
      { action: 'UpdateObjectiveProgress', from: 'ACTIVE', to: 'IN_PROGRESS', eventName: 'ObjectiveProgressUpdated' },
      { action: 'UpdateObjectiveProgress', from: 'IN_PROGRESS', to: 'IN_PROGRESS', eventName: 'ObjectiveProgressUpdated' },
      { action: 'UpdateObjectiveProgress', from: 'IN_PROGRESS', to: 'ACHIEVED', eventName: 'ObjectiveAchieved' },
      { action: 'MarkObjectiveAchieved', from: 'ACTIVE', to: 'ACHIEVED', eventName: 'ObjectiveAchieved' },
      { action: 'MarkObjectiveAchieved', from: 'IN_PROGRESS', to: 'ACHIEVED', eventName: 'ObjectiveAchieved' },
      { action: 'CancelObjective', from: 'DRAFT', to: 'CANCELLED', eventName: 'ObjectiveCancelled' },
      { action: 'CancelObjective', from: 'ACTIVE', to: 'CANCELLED', eventName: 'ObjectiveCancelled' },
      { action: 'CancelObjective', from: 'IN_PROGRESS', to: 'CANCELLED', eventName: 'ObjectiveCancelled' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ACHIEVED', 'PARTIAL', 'MISSED', 'CANCELLED'],
  };
  fsm.register(definition);
}
