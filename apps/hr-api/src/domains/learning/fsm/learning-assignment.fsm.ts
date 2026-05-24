import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerLearningAssignmentFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'LearningAssignment',
    states: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'CANCELLED'],
    actions: ['CreateLearningAssignment', 'StartLearningAssignment', 'CompleteLearningAssignment', 'ExpireLearningAssignment', 'CancelLearningAssignment'],
    transitions: [
      { action: 'CreateLearningAssignment', from: 'ASSIGNED', to: 'ASSIGNED', eventName: 'LearningAssignmentAssigned' },
      { action: 'StartLearningAssignment', from: 'ASSIGNED', to: 'IN_PROGRESS', eventName: 'LearningAssignmentStarted' },
      { action: 'CompleteLearningAssignment', from: 'ASSIGNED', to: 'COMPLETED', eventName: 'LearningAssignmentCompleted' },
      { action: 'CompleteLearningAssignment', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'LearningAssignmentCompleted' },
      { action: 'ExpireLearningAssignment', from: 'ASSIGNED', to: 'EXPIRED', eventName: 'LearningAssignmentExpired' },
      { action: 'ExpireLearningAssignment', from: 'IN_PROGRESS', to: 'EXPIRED', eventName: 'LearningAssignmentExpired' },
      { action: 'CancelLearningAssignment', from: 'ASSIGNED', to: 'CANCELLED', eventName: 'LearningAssignmentCancelled' },
      { action: 'CancelLearningAssignment', from: 'IN_PROGRESS', to: 'CANCELLED', eventName: 'LearningAssignmentCancelled' },
    ],
    initialState: 'ASSIGNED',
    terminalStates: ['COMPLETED', 'EXPIRED', 'CANCELLED'],
  };
  fsm.register(definition);
}
